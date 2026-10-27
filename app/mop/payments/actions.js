"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { validateClientName, PRODUCT_LABELS, PAY_LABELS } from "@/lib/revenueKinds";
import {
  EDIT_REASON_MAX,
  editDateBounds,
  editSnapshot,
  isMissingTable,
  paymentDayKey,
  sameValue,
} from "@/lib/revenueEdits";

const ALLOWED_ROLES = ["mop", "rop", "mentor", "trainee"];

// Сотрудник предлагает исправить свою оплату. Сама оплата тут не меняется:
// заявка на исправление уходит админу (/admin/revenue-edits), и только он
// её применяет. Вставка идёт от имени сотрудника, база сама проверяет
// (RLS), что оплата его и заявка «на рассмотрении».
export async function submitRevenueEdit(requestId, input = {}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { data: profile } = await supabase
    .from("users")
    .select("role, is_guest, is_active")
    .eq("id", user.id)
    .single();
  if (profile?.is_guest) return { error: "В гостевом режиме исправления не отправляются" };
  if (!ALLOWED_ROLES.includes(profile?.role) || profile?.is_active === false) {
    return { error: "Исправления оплат недоступны" };
  }

  const { data: request } = await supabase
    .from("revenue_requests")
    .select("id, user_id, status, amount_kzt, earned_at, created_at, client_name, product_kind, pay_kind, is_final_part")
    .eq("id", requestId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!request) return { error: "Оплата не найдена" };
  if (request.status === "rejected") return { error: "Отклонённую оплату исправить нельзя" };

  // Те же правила, что у новой заявки на выручку.
  const amount = Number(String(input.amountKzt ?? "").replace(/\s/g, ""));
  if (!Number.isInteger(amount) || amount <= 0) {
    return { error: "Сумма должна быть целым числом больше нуля" };
  }

  const clientCheck = validateClientName(input.clientName);
  if (clientCheck.error) return { error: clientCheck.error };

  const productKind = input.productKind;
  const payKind = input.payKind;
  if (!PRODUCT_LABELS[productKind]) return { error: "Выбери продукт: курс или интенсив / МК" };
  if (!PAY_LABELS[payKind]) return { error: "Выбери вид оплаты: целиком или часть" };
  const isFinalPart = payKind === "full" ? true : input.isFinalPart === true;

  // Дату в исправлении можно поставить любую с первого числа прошлого
  // месяца по сегодня: ошибку часто находят при сверке в конце месяца.
  // Старую оплату можно исправить, не трогая её дату.
  const day = String(input.paymentDay ?? "");
  const bounds = editDateBounds();
  const sameDay = day === paymentDayKey(request);
  if (!sameDay && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < bounds.min || day > bounds.max)) {
    return { error: "Дату оплаты можно поставить с начала прошлого месяца по сегодня" };
  }

  const reason = String(input.reason ?? "").trim().slice(0, EDIT_REASON_MAX);
  if (reason.length < 3) return { error: "Напиши, что не так с оплатой" };

  // В заявку кладём только то, что действительно меняется.
  const proposed = {};
  if (!sameValue("amount_kzt", request.amount_kzt, amount)) proposed.amount_kzt = amount;
  if (!sameDay) {
    proposed.earned_at = new Date(`${day}T12:00:00+05:00`).toISOString();
  }
  if (!sameValue("client_name", request.client_name, clientCheck.name)) {
    proposed.client_name = clientCheck.name;
  }
  if (request.product_kind !== productKind) proposed.product_kind = productKind;
  if (request.pay_kind !== payKind) proposed.pay_kind = payKind;
  if (Boolean(request.is_final_part) !== isFinalPart) proposed.is_final_part = isFinalPart;

  if (!Object.keys(proposed).length) {
    return { error: "Ничего не изменилось: поменяй хотя бы одно поле" };
  }

  const { error } = await supabase.from("revenue_edit_requests").insert({
    request_id: request.id,
    user_id: user.id,
    proposed,
    original: editSnapshot(request),
    reason,
    status: "pending",
  });

  if (error) {
    if (isMissingTable(error)) return { error: "Исправления оплат пока не включены" };
    if (error.code === "23505") return { error: "Исправление этой оплаты уже на рассмотрении" };
    return { error: "Не удалось отправить исправление" };
  }

  revalidatePath("/mop/payments");
  revalidatePath("/admin/revenue-edits");
  return { success: true };
}
