"use server";

import { formatCoins } from "@/lib/plural";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { notifyUser, escapeHtml } from "@/lib/notifyUser";
import { logRevenueChange } from "@/lib/revenueAudit";
import { calculateRevenueCoins } from "@/lib/coinRate";
import { applyPaymentAdjustment } from "@/lib/paymentAdjust";
import { almatyDayKey } from "@/lib/timezone";
import {
  EDIT_FIELD_LABELS,
  driftedFields,
  editSnapshot,
  editValueText,
  isMissingTable,
} from "@/lib/revenueEdits";

const TEXT_FIELDS = ["client_name", "product_kind", "pay_kind", "is_final_part"];

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
  return Number(n ?? 0).toLocaleString("ru-RU");
}

function revalidateAll() {
  revalidatePath("/admin/revenue-edits");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/revenue-requests");
  revalidatePath("/mop/payments");
  revalidatePath("/mop/rating");
}

// «Сумма: 100 000 ₸ → 90 000 ₸» по каждому изменённому полю.
function changeLines(before, proposed) {
  return Object.keys(proposed)
    .filter((f) => EDIT_FIELD_LABELS[f])
    .map(
      (f) =>
        `${EDIT_FIELD_LABELS[f]}: ${editValueText(f, before?.[f])} → ${editValueText(f, proposed[f])}`
    );
}

async function loadEdit(admin, editId) {
  const { data: edit, error } = await admin
    .from("revenue_edit_requests")
    .select("*")
    .eq("id", editId)
    .maybeSingle();
  if (error) {
    return { error: isMissingTable(error) ? "Раздел ещё не включён" : "Не удалось загрузить исправление" };
  }
  if (!edit) return { error: "Исправление не найдено" };
  if (edit.status !== "pending") return { error: "Исправление уже рассмотрено" };
  return { edit };
}

// Применить исправление. Порядок как у одобрения заявок: сначала условно
// «захватываем» исправление (pending → approved), и только потом трогаем
// оплату и коины. Двойной тап или два админа: второй получит «уже
// рассмотрено». Если применение не удалось, возвращаем исправление в pending.
export async function applyRevenueEdit(editId) {
  const admin_user = await requireAdmin();
  const admin = createAdminClient();

  const loaded = await loadEdit(admin, editId);
  if (loaded.error) return { error: loaded.error };
  const { edit } = loaded;

  const proposed = edit.proposed ?? {};
  if (!Object.keys(proposed).length) return { error: "В исправлении нет изменений, отклоните его" };

  const { data: payment } = await admin
    .from("revenue_requests")
    .select("*")
    .eq("id", edit.request_id)
    .maybeSingle();
  if (!payment || payment.status === "rejected") {
    return { error: "Эту оплату уже отменили или отклонили. Отклоните исправление." };
  }

  // Оплату могли поменять, пока исправление ждало (админ поправил сумму
  // сам, или сотрудник подал правку дважды через разные пути). Тогда
  // предложение посчитано от старых значений: не применяем вслепую.
  const current = editSnapshot(payment);
  const drift = driftedFields(edit.original, current, Object.keys(proposed));
  if (drift.length) {
    const lines = drift.map(
      (f) =>
        `${EDIT_FIELD_LABELS[f]}: при подаче было ${editValueText(f, edit.original[f])}, сейчас ${editValueText(f, current[f])}`
    );
    return {
      error: `Оплату уже изменили после подачи исправления. ${lines.join("; ")}. Отклоните исправление, сотрудник подаст новое по актуальным данным.`,
    };
  }

  const { data: claimed } = await admin
    .from("revenue_edit_requests")
    .update({
      status: "approved",
      reviewed_by: admin_user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", edit.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return { error: "Исправление уже рассмотрено" };

  const release = async () => {
    await admin
      .from("revenue_edit_requests")
      .update({ status: "pending", reviewed_by: null, reviewed_at: null })
      .eq("id", edit.id)
      .eq("status", "approved");
  };

  const reasonNote = `Исправление от сотрудника: ${edit.reason}`;
  const textPatch = {};
  for (const f of TEXT_FIELDS) if (f in proposed) textPatch[f] = proposed[f];

  let coinsDiff = 0;

  if (payment.status === "approved") {
    if ("amount_kzt" in proposed || "earned_at" in proposed) {
      // Сумма или дата: то же действие, что у админской правки оплаты,
      // коины пересчитываются по шкале месяца и множителю.
      const res = await applyPaymentAdjustment(admin, {
        request: payment,
        actorId: admin_user.id,
        amountKzt: proposed.amount_kzt ?? payment.amount_kzt,
        earnedAt: proposed.earned_at ? almatyDayKey(proposed.earned_at) : null,
        reason: reasonNote,
        extraPatch: textPatch,
        markRefund: false,
      });
      if (res.error) {
        await release();
        return { error: res.error };
      }
      coinsDiff = res.diff;
    } else {
      // Только ФИО, продукт или вид оплаты: на коины и рейтинг не влияет.
      const { data: updated, error } = await admin
        .from("revenue_requests")
        .update(textPatch)
        .eq("id", payment.id)
        .eq("status", "approved")
        .select("id");
      if (error || !updated?.length) {
        await release();
        return { error: "Не удалось обновить оплату: её только что изменили. Обновите страницу." };
      }
      await logRevenueChange(admin, {
        requestId: payment.id,
        userId: payment.user_id,
        actorId: admin_user.id,
        source: "web",
        action: "edit",
        before: Object.fromEntries(Object.keys(textPatch).map((f) => [f, payment[f] ?? null])),
        after: textPatch,
        note: reasonNote,
      });
    }
  } else {
    // Оплата ещё ждёт одобрения: коины по ней не начислены, просто правим
    // заявку. При одобрении коины посчитаются от новой суммы и даты.
    const patch = { ...textPatch };
    if ("amount_kzt" in proposed) {
      patch.amount_kzt = proposed.amount_kzt;
      const { data: profile } = await admin
        .from("users")
        .select("coin_rate_multiplier")
        .eq("id", payment.user_id)
        .single();
      patch.calculated_coins = calculateRevenueCoins(proposed.amount_kzt, profile?.coin_rate_multiplier);
    }
    if ("earned_at" in proposed) patch.earned_at = proposed.earned_at;

    const { data: updated, error } = await admin
      .from("revenue_requests")
      .update(patch)
      .eq("id", payment.id)
      .eq("status", "pending")
      .select("id");
    if (error || !updated?.length) {
      await release();
      return {
        error: "Оплату только что одобрили или отклонили. Обновите страницу и примените ещё раз.",
      };
    }

    const before = {};
    const after = {};
    for (const f of Object.keys(proposed)) {
      before[f] = payment[f] ?? null;
      after[f] = proposed[f];
    }
    await logRevenueChange(admin, {
      requestId: payment.id,
      userId: payment.user_id,
      actorId: admin_user.id,
      source: "web",
      action: "edit",
      before,
      after,
      note: reasonNote,
    });
  }

  let text = `✏️ <b>Исправление оплаты применено</b>\n\n`;
  text += changeLines(current, proposed).map(escapeHtml).join("\n");
  if (coinsDiff > 0) text += `\n\nНачислили ещё ${formatCoins(coinsDiff)}`;
  if (coinsDiff < 0) text += `\n\nСписали ${formatCoins(-coinsDiff)}`;
  await notifyUser(admin, edit.user_id, text, "notify_requests");

  revalidateAll();
  return { success: true, diff: coinsDiff };
}

// Отклонить исправление: оплата не меняется, сотруднику уходит причина.
export async function rejectRevenueEdit(editId, comment) {
  const admin_user = await requireAdmin();
  const admin = createAdminClient();

  const loaded = await loadEdit(admin, editId);
  if (loaded.error) return { error: loaded.error };
  const { edit } = loaded;

  const note = String(comment ?? "").trim().slice(0, 500);

  const { data: claimed } = await admin
    .from("revenue_edit_requests")
    .update({
      status: "rejected",
      admin_comment: note || null,
      reviewed_by: admin_user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", edit.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return { error: "Исправление уже рассмотрено" };

  const { data: payment } = await admin
    .from("revenue_requests")
    .select("amount_kzt, client_name")
    .eq("id", edit.request_id)
    .maybeSingle();

  let text = `❌ <b>Исправление оплаты не принято</b>`;
  if (payment) {
    text += `\n\nОплата ${money(payment.amount_kzt)} ₸`;
    if (payment.client_name) text += `, ${escapeHtml(payment.client_name)}`;
    text += `. Она осталась как была.`;
  }
  if (note) text += `\n\n💬 ${escapeHtml(note)}`;
  await notifyUser(admin, edit.user_id, text, "notify_requests");

  revalidateAll();
  return { success: true };
}
