"use server";

import { formatCoins } from "@/lib/plural";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { notifyUser, escapeHtml } from "@/lib/notifyUser";
import { revokeMentorBonus } from "@/lib/mentorBonus";
import { validateClientName, PRODUCT_LABELS, PAY_LABELS } from "@/lib/revenueKinds";
import { almatyDayKey } from "@/lib/timezone";
import { applyPaymentAdjustment } from "@/lib/paymentAdjust";
import { addCoins } from "@/lib/addCoins";
import { logRevenueChange } from "@/lib/revenueAudit";
import { markTelegramRequestHandled, userNameById } from "@/lib/telegramMessageSync";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Доступ запрещён");
  return user;
}

function money(n) {
  return Number(n).toLocaleString("ru-RU");
}

// Поиск оплат: по сотруднику, по периоду, по сумме. Нужен, чтобы
// находить конкретную оплату и править её, а не листать всю историю.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Список id сотрудников: только настоящие uuid, без повторов, не больше 100.
export async function findPayments({ userId, userIds, from, to, query } = {}) {
  await requireAdmin();
  const supabase = createClient();

  let q = supabase
    .from("revenue_requests")
    .select("*, users!revenue_requests_user_id_fkey(name)")
    .eq("status", "approved")
    .order("earned_at", { ascending: false, nullsFirst: false })
    .limit(2000);

  const ids = [...new Set([...(Array.isArray(userIds) ? userIds : []), ...(userId ? [userId] : [])]
    .map((x) => String(x))
    .filter((x) => UUID_RE.test(x)))].slice(0, 100);
  if (ids.length === 1) q = q.eq("user_id", ids[0]);
  else if (ids.length > 1) q = q.in("user_id", ids);
  if (from) q = q.gte("earned_at", new Date(`${from}T00:00:00+05:00`).toISOString());
  if (to) q = q.lte("earned_at", new Date(`${to}T23:59:59+05:00`).toISOString());

  const { data, error } = await q;
  if (error) return { error: error.message };

  let rows = data ?? [];
  const clean = String(query ?? "").replace(/\D/g, "");
  if (clean) rows = rows.filter((r) => String(r.amount_kzt).includes(clean));

  return { rows };
}

// Отмена подтверждённой оплаты: коины списываются, заявка уходит из
// рейтинга (он считается по подтверждённым оплатам), сотруднику
// уходит сообщение с причиной.
export async function cancelPayment(requestId, reason) {
  const admin_user = await requireAdmin();
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("revenue_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "approved") {
    return { error: "Оплата не найдена или уже отменена" };
  }

  // У старых заявок credited_coins не заполнялся — берём расчётное.
  const coins = request.credited_coins ?? request.calculated_coins ?? 0;

  // Процент наставника живёт на этой же оплате — снимаем вместе с ней.
  await revokeMentorBonus(admin, requestId);

  const { data: profile } = await admin
    .from("users")
    .select("balance")
    .eq("id", request.user_id)
    .single();

  await addCoins(admin, request.user_id, -coins);

  await admin
    .from("revenue_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin_user.id,
    })
    .eq("id", requestId);

  await logRevenueChange(admin, {
    requestId,
    userId: request.user_id,
    actorId: admin_user.id,
    source: "web",
    action: "cancel",
    before: { status: "approved", amount_kzt: request.amount_kzt, credited_coins: coins, earned_at: request.earned_at, client_name: request.client_name },
    after: { status: "rejected" },
    note: reason,
  });

  if (coins) {
    await admin.from("transactions").insert({
      user_id: request.user_id,
      type: "manual_subtract",
      amount_coins: -coins,
      description: `Оплата отменена: ${money(request.amount_kzt)} ₸`,
      created_by: admin_user.id,
      source: "manual",
      rating_exempt: true,
    });
  }

  let text = `⚠️ Оплата ${money(request.amount_kzt)} ₸ отменена${
    coins ? ` — ${formatCoins(coins)} списаны обратно` : ""
  }`;
  if (reason?.trim()) text += `\n\n💬 ${escapeHtml(reason.trim())}`;
  await notifyUser(admin, request.user_id, text, "notify_requests");

  await markTelegramRequestHandled(admin, { table: "revenue_requests", id: requestId, status: "cancelled", byName: await userNameById(admin, admin_user.id) });

  revalidatePath("/admin/payments");
  revalidatePath("/mop/rating");
  return { success: true };
}

// Частичная правка: сумму уменьшили (сделку поделили с другим МОПом)
// или дата оплаты оказалась другой. Коины пересчитываются, разница
// списывается или доначисляется (lib/paymentAdjust.js).
export async function adjustPayment(
  requestId,
  { amountKzt, earnedAt, reason, clientName, productKind, payKind, isFinalPart }
) {
  const admin_user = await requireAdmin();
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("revenue_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request) return { error: "Оплата не найдена или уже отменена" };

  // ФИО, продукт и вид оплаты: на коины не влияют, пишутся тем же обновлением.
  const extraPatch = {};
  // Старое ФИО, которое не трогали, не проверяем: правят только сумму.
  const typedName = String(clientName ?? "").replace(/\s+/g, " ").trim();
  if (clientName !== undefined && typedName !== (request.client_name ?? "")) {
    const check = validateClientName(typedName);
    if (check.error) return { error: check.error };
    extraPatch.client_name = check.name;
  }
  if (productKind && productKind !== request.product_kind) {
    if (!PRODUCT_LABELS[productKind]) return { error: "Выбери продукт: курс или интенсив / МК" };
    extraPatch.product_kind = productKind;
  }
  if (payKind) {
    if (!PAY_LABELS[payKind]) return { error: "Выбери вид оплаты: целиком или часть" };
    if (payKind !== request.pay_kind) extraPatch.pay_kind = payKind;
    const final = payKind === "full" ? true : isFinalPart === true;
    if (final !== (request.is_final_part === true)) extraPatch.is_final_part = final;
  }

  // Дата не менялась (тот же день по Алматы): не трогаем время и коины.
  const sameDay =
    earnedAt && almatyDayKey(request.earned_at || request.created_at) === earnedAt;

  const res = await applyPaymentAdjustment(admin, {
    request,
    actorId: admin_user.id,
    amountKzt,
    earnedAt: sameDay ? null : earnedAt,
    reason,
    extraPatch,
  });
  if (res.error) return { error: res.error };

  const { diff, newAmount } = res;
  let text = `✏️ Оплата ${money(request.amount_kzt)} ₸ исправлена на ${money(newAmount)} ₸`;
  if (newAmount === Math.round(Number(request.amount_kzt)) && Object.keys(extraPatch).length) {
    text = `✏️ В оплате ${money(request.amount_kzt)} ₸ исправили данные клиента или тип оплаты`;
  }
  if (diff !== 0) {
    text += diff > 0 ? ` — начислили ещё ${formatCoins(diff)}` : ` — списали ${formatCoins(-diff)}`;
  }
  if (reason?.trim()) text += `\n\n💬 ${escapeHtml(reason.trim())}`;
  await notifyUser(admin, request.user_id, text, "notify_requests");

  revalidatePath("/admin/payments");
  revalidatePath("/mop/rating");
  return { success: true };
}

// Ждущей решения заявке правим только ФИО клиента (сотрудник вставил
// лишнее). Сумма, коины и статус не трогаются, так что одобрение не
// страдает: меняем, только пока заявка всё ещё pending.
export async function fixPendingClientName(requestId, clientName) {
  const admin_user = await requireAdmin();
  const admin = createAdminClient();

  const check = validateClientName(clientName);
  if (check.error) return { error: check.error };

  const { data: request } = await admin
    .from("revenue_requests")
    .select("id, user_id, status, client_name")
    .eq("id", requestId)
    .single();
  if (!request || request.status !== "pending") return { error: "Заявка уже обработана" };

  const { data: updated, error } = await admin
    .from("revenue_requests")
    .update({ client_name: check.name })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");
  if (error) return { error: "Не удалось сохранить ФИО" };
  if (!updated?.length) return { error: "Заявка уже обработана" };

  await logRevenueChange(admin, {
    requestId,
    userId: request.user_id,
    actorId: admin_user.id,
    source: "web",
    action: "edit",
    before: { client_name: request.client_name ?? null },
    after: { client_name: check.name },
    note: "Админ поправил ФИО клиента",
  });

  revalidatePath("/admin/revenue-requests");
  return { success: true, name: check.name };
}
