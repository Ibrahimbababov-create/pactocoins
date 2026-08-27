"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { checkAndApplyLevelUp } from "@/lib/levelUp";
import { notifyUser } from "@/lib/notifyUser";

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

// Еженедельный бонус топ-3 за прошлую неделю. items = [{ userId, amount }].
// Всегда rating_exempt = true (не должно влиять на рейтинг).
export async function awardWeeklyTop3(items, reason) {
  await requireAdmin();
  const admin = createAdminClient();

  const clean = (items ?? []).filter(
    (i) => i && i.userId && Number(i.amount) > 0
  );
  if (clean.length === 0) return { error: "Укажи суммы для победителей" };

  let count = 0;
  for (const { userId, amount } of clean) {
    const amt = Math.round(Number(amount));

    const { data: profile } = await admin
      .from("users")
      .select("balance, total_earned, month_earned")
      .eq("id", userId)
      .single();
    if (!profile) continue;

    await admin
      .from("users")
      .update({
        balance: profile.balance + amt,
        total_earned: profile.total_earned + amt,
        month_earned: profile.month_earned + amt,
      })
      .eq("id", userId);

    await checkAndApplyLevelUp(userId, admin);

    await admin.from("transactions").insert({
      user_id: userId,
      type: "manual_add",
      amount_coins: amt,
      description: reason || "ТОП-3 за неделю",
      rating_exempt: true,
    });

    await notifyUser(
      admin,
      userId,
      `🏆 ${reason || "Бонус за топ прошлой недели"} — +${amt} coins`,
      "notify_requests"
    );

    count++;
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
    .select("balance, total_earned, month_earned")
    .eq("id", userId)
    .single();

  const newBalance = profile.balance + amount;
  if (newBalance < 0) return { error: "Баланс не может уйти в минус" };

  const update = { balance: newBalance };
  if (amount > 0) {
    update.total_earned = profile.total_earned + amount;
    update.month_earned = profile.month_earned + amount;
  }

  const { error: updateError } = await admin
    .from("users")
    .update(update)
    .eq("id", userId);

  if (updateError) return { error: updateError.message };

  if (amount > 0) {
    await checkAndApplyLevelUp(userId, admin);
  }

  await admin.from("transactions").insert({
    user_id: userId,
    type: amount >= 0 ? "manual_add" : "manual_subtract",
    amount_coins: amount,
    description: description || "Ручная корректировка",
    rating_exempt: !!ratingExempt,
  });

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
      .select("balance, total_earned, month_earned")
      .eq("id", userId)
      .single();

    if (!profile) continue;

    const newBalance = profile.balance + amount;
    if (newBalance < 0) continue;

    const update = { balance: newBalance };
    if (amount > 0) {
      update.total_earned = profile.total_earned + amount;
      update.month_earned = profile.month_earned + amount;
    }

    await admin.from("users").update(update).eq("id", userId);

    if (amount > 0) {
      await checkAndApplyLevelUp(userId, admin);
    }

    await admin.from("transactions").insert({
      user_id: userId,
      type: amount >= 0 ? "manual_add" : "manual_subtract",
      amount_coins: amount,
      description: description || "Массовое начисление",
      rating_exempt: !!ratingExempt,
    });

    successCount++;
  }

  revalidatePath("/admin/employees");
  revalidatePath("/admin/bonus-requests");
  revalidatePath("/admin");
  revalidatePath("/mop/rating");
  return { success: true, count: successCount };
}

export async function approveBonusRequestExempt(requestId, ratingExempt) {
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

  const { data: profile } = await admin
    .from("users")
    .select("balance, total_earned, month_earned")
    .eq("id", request.user_id)
    .single();

  const coins = request.amount_coins;

  await admin
    .from("users")
    .update({
      balance: profile.balance + coins,
      total_earned: profile.total_earned + coins,
      month_earned: profile.month_earned + coins,
    })
    .eq("id", request.user_id);

  await checkAndApplyLevelUp(request.user_id, admin);

  await admin
    .from("bonus_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin_user.id,
    })
    .eq("id", requestId);

  await admin.from("transactions").insert({
    user_id: request.user_id,
    type: "earn",
    amount_coins: coins,
    description: `Бонус: ${request.category}`,
    created_by: admin_user.id,
    rating_exempt: !!ratingExempt,
  });

  await notifyUser(
    admin,
    request.user_id,
    `✅ Заявка на бонус одобрена — +${coins} coins`,
    "notify_requests"
  );

  revalidatePath("/admin/bonus-requests");
  revalidatePath("/admin");
  revalidatePath("/mop/rating");
  return { success: true };
}
