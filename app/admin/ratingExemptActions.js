"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { checkAndApplyLevelUp } from "@/lib/levelUp";
import { notifyUser, escapeHtml } from "@/lib/notifyUser";
import { sendTelegramMessage } from "@/lib/telegramBot";

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

// Бонус топ-3 за период (неделя/месяц). items = [{ userId, name, amount }].
// periodPhrase — "за прошлую неделю" / "за прошлый месяц" (для текстов).
// Всегда rating_exempt = true (не должно влиять на рейтинг).
export async function awardTop3Bonus(items, reason, periodPhrase = "за период") {
  await requireAdmin();
  const admin = createAdminClient();

  const clean = (items ?? []).filter(
    (i) => i && i.userId && Number(i.amount) > 0
  );
  if (clean.length === 0) return { error: "Укажи суммы для победителей" };

  const MEDALS = ["🥇", "🥈", "🥉"];
  const awarded = [];
  let count = 0;
  for (let idx = 0; idx < clean.length; idx++) {
    const { userId, amount, name } = clean[idx];
    const amt = Math.round(Number(amount));

    const { data: profile } = await admin
      .from("users")
      .select("name, balance")
      .eq("id", userId)
      .single();
    if (!profile) continue;

    await admin
      .from("users")
      .update({
        balance: profile.balance + amt,
      })
      .eq("id", userId);

    await admin.from("transactions").insert({
      user_id: userId,
      type: "manual_add",
      amount_coins: amt,
      description: reason || `Топ-3 ${periodPhrase}`,
      rating_exempt: true,
    });

    await checkAndApplyLevelUp(userId, admin);

    await notifyUser(
      admin,
      userId,
      `🏆 ${reason || `Бонус за топ ${periodPhrase}`} — +${amt} коинов`,
      "notify_requests"
    );

    awarded.push({
      medal: MEDALS[idx] ?? "🏅",
      name: name || profile.name || "—",
      amt,
    });
    count++;
  }

  // Объявление в общий чат — тот же, куда идут поздравления с ДР/рангами.
  const groupChatId = process.env.TELEGRAM_ANNOUNCE_CHAT_ID;
  if (groupChatId && awarded.length) {
    const threadId = process.env.TELEGRAM_ANNOUNCE_THREAD_ID
      ? Number(process.env.TELEGRAM_ANNOUNCE_THREAD_ID)
      : undefined;
    const lines = awarded
      .map((a) => `${a.medal} <b>${a.name}</b> — +${a.amt} коинов`)
      .join("\n");
    try {
      await sendTelegramMessage(
        groupChatId,
        `🏆 <b>Бонусы за топ ${periodPhrase}</b>\n\n${lines}`,
        undefined,
        threadId
      );
    } catch (err) {
      console.error("[awardTop3Bonus] group announce failed:", err);
    }
  }

  revalidatePath("/admin/bonus-requests");
  revalidatePath("/admin");
  return { success: true, count };
}

export async function manualAdjustBalanceExempt(
  userId,
  amount,
  description,
  ratingExempt
) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("users")
    .select("balance")
    .eq("id", userId)
    .single();

  const newBalance = profile.balance + amount;
  if (newBalance < 0) return { error: "Баланс не может уйти в минус" };

  const { error: updateError } = await admin
    .from("users")
    .update({ balance: newBalance })
    .eq("id", userId);

  if (updateError) return { error: updateError.message };

  await admin.from("transactions").insert({
    user_id: userId,
    type: amount >= 0 ? "manual_add" : "manual_subtract",
    amount_coins: amount,
    description: description || "Ручная корректировка",
    rating_exempt: !!ratingExempt,
  });

  if (amount > 0) {
    await checkAndApplyLevelUp(userId, admin);
  }

  revalidatePath("/admin/employees");
  revalidatePath("/admin");
  revalidatePath("/mop/rating");
  return { success: true };
}

export async function manualAdjustBalanceBulkExempt(
  userIds,
  amount,
  description,
  ratingExempt
) {
  await requireAdmin();
  const admin = createAdminClient();

  let successCount = 0;

  for (const userId of userIds) {
    const { data: profile } = await admin
      .from("users")
      .select("balance")
      .eq("id", userId)
      .single();

    if (!profile) continue;

    const newBalance = profile.balance + amount;
    if (newBalance < 0) continue;

    await admin.from("users").update({ balance: newBalance }).eq("id", userId);

    await admin.from("transactions").insert({
      user_id: userId,
      type: amount >= 0 ? "manual_add" : "manual_subtract",
      amount_coins: amount,
      description: description || "Массовое начисление",
      rating_exempt: !!ratingExempt,
    });

    if (amount > 0) {
      await checkAndApplyLevelUp(userId, admin);
    }

    successCount++;
  }

  revalidatePath("/admin/employees");
  revalidatePath("/admin/bonus-requests");
  revalidatePath("/admin");
  revalidatePath("/mop/rating");
  return { success: true, count: successCount };
}

export async function approveBonusRequestExempt(requestId, ratingExempt, comment) {
  const admin_user = await requireAdmin();
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("bonus_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "pending") {
    return { error: "Заявка уже обработана" };
  }

  // «Приход вовремя» — награда не coins, а крутка на колесе фортуны.
  const spinOnly = request.category === "attendance";
  const coins = spinOnly ? 0 : request.amount_coins;

  if (!spinOnly) {
    const { data: profile } = await admin
      .from("users")
      .select("balance")
      .eq("id", request.user_id)
      .single();

    await admin
      .from("users")
      .update({
        balance: profile.balance + coins,
      })
      .eq("id", request.user_id);
  }

  await admin
    .from("bonus_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin_user.id,
      credited_coins: coins,
    })
    .eq("id", requestId);

  if (!spinOnly) {
    await admin.from("transactions").insert({
      user_id: request.user_id,
      type: "earn",
      amount_coins: coins,
      description: `Бонус: ${request.category}`,
      created_by: admin_user.id,
      rating_exempt: !!ratingExempt,
    });

    await checkAndApplyLevelUp(request.user_id, admin);

    const bonusText = `✅ Заявка на бонус одобрена — +${coins} коинов`;
    await notifyUser(
      admin,
      request.user_id,
      comment?.trim() ? `${bonusText}\n\n💬 ${escapeHtml(comment.trim())}` : bonusText,
      "notify_requests"
    );
  }

  // За приход вовремя — крутка на колесе фортуны (1 за заявку).
  if (spinOnly) {
    const { data: w } = await admin
      .from("users")
      .select("wheel_spins")
      .eq("id", request.user_id)
      .single();
    await admin
      .from("users")
      .update({ wheel_spins: (w?.wheel_spins ?? 0) + 1 })
      .eq("id", request.user_id);
    const spinText = "🎡 +1 крутка на колесе фортуны за приход вовремя!";
    await notifyUser(
      admin,
      request.user_id,
      comment?.trim() ? `${spinText}\n\n💬 ${escapeHtml(comment.trim())}` : spinText,
      "notify_requests"
    );
  }

  revalidatePath("/admin/bonus-requests");
  revalidatePath("/admin");
  revalidatePath("/mop/rating");
  return { success: true };
}
