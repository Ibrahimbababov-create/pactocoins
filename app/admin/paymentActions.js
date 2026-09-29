"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { calculateRevenueCoins } from "@/lib/coinRate";
import { notifyUser, escapeHtml } from "@/lib/notifyUser";

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
export async function findPayments({ userId, from, to, query } = {}) {
  await requireAdmin();
  const supabase = createClient();

  let q = supabase
    .from("revenue_requests")
    .select("*, users!revenue_requests_user_id_fkey(name)")
    .eq("status", "approved")
    .order("earned_at", { ascending: false, nullsFirst: false })
    .limit(60);

  if (userId) q = q.eq("user_id", userId);
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

  const coins = request.credited_coins ?? 0;

  const { data: profile } = await admin
    .from("users")
    .select("balance")
    .eq("id", request.user_id)
    .single();

  await admin
    .from("users")
    .update({ balance: (profile?.balance ?? 0) - coins })
    .eq("id", request.user_id);

  await admin
    .from("revenue_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin_user.id,
    })
    .eq("id", requestId);

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
    coins ? ` — ${coins} коинов списаны обратно` : ""
  }`;
  if (reason?.trim()) text += `\n\n💬 ${escapeHtml(reason.trim())}`;
  await notifyUser(admin, request.user_id, text, "notify_requests");

  revalidatePath("/admin/payments");
  revalidatePath("/mop/rating");
  return { success: true };
}

// Частичная правка: сумму уменьшили (сделку поделили с другим МОПом)
// или дата оплаты оказалась другой. Коины пересчитываются, разница
// списывается или доначисляется.
export async function adjustPayment(requestId, { amountKzt, earnedAt, reason }) {
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

  const newAmount = Number(amountKzt);
  if (!newAmount || newAmount <= 0) return { error: "Сумма должна быть больше нуля" };

  const { data: profile } = await admin
    .from("users")
    .select("balance, coin_rate_multiplier")
    .eq("id", request.user_id)
    .single();

  const newCoins = calculateRevenueCoins(newAmount, profile?.coin_rate_multiplier);
  const oldCoins = request.credited_coins ?? 0;
  const diff = newCoins - oldCoins;

  const patch = {
    amount_kzt: newAmount,
    calculated_coins: newCoins,
    credited_coins: newCoins,
  };
  if (earnedAt) {
    const parsed = new Date(`${earnedAt}T12:00:00+05:00`);
    if (!isNaN(parsed)) patch.earned_at = parsed.toISOString();
  }

  await admin.from("revenue_requests").update(patch).eq("id", requestId);

  if (diff !== 0) {
    await admin
      .from("users")
      .update({ balance: (profile?.balance ?? 0) + diff })
      .eq("id", request.user_id);

    await admin.from("transactions").insert({
      user_id: request.user_id,
      type: diff > 0 ? "manual_add" : "manual_subtract",
      amount_coins: diff,
      description: `Правка оплаты: ${money(request.amount_kzt)} ₸ → ${money(newAmount)} ₸`,
      created_by: admin_user.id,
      source: "manual",
      rating_exempt: true,
    });
  }

  let text = `✏️ Оплата ${money(request.amount_kzt)} ₸ исправлена на ${money(newAmount)} ₸`;
  if (diff !== 0) {
    text += diff > 0 ? ` — начислили ещё ${diff} коинов` : ` — списали ${-diff} коинов`;
  }
  if (reason?.trim()) text += `\n\n💬 ${escapeHtml(reason.trim())}`;
  await notifyUser(admin, request.user_id, text, "notify_requests");

  revalidatePath("/admin/payments");
  revalidatePath("/mop/rating");
  return { success: true };
}
