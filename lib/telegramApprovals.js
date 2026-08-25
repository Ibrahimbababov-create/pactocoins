import { createAdminClient } from "@/lib/supabase-admin";
import { checkAndApplyLevelUp } from "@/lib/levelUp";
import { calculateRevenueCoins } from "@/lib/coinRate";

export async function approveRevenueRequestInternal(requestId) {
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("revenue_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "pending") {
    return { error: "Заявка уже обработана" };
  }

  const { data: profile } = await admin
    .from("users")
    .select("balance, total_earned, month_earned, coin_rate_multiplier")
    .eq("id", request.user_id)
    .single();

  const coins = calculateRevenueCoins(
    request.amount_kzt,
    profile.coin_rate_multiplier
  );

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
    .from("revenue_requests")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", requestId);

  await admin.from("transactions").insert({
    user_id: request.user_id,
    type: "earn",
    amount_coins: coins,
    description: `Выручка подтверждена: ${request.amount_kzt.toLocaleString(
      "ru-RU"
    )} ₸`,
  });

  return { success: true };
}

export async function rejectRevenueRequestInternal(requestId) {
  const admin = createAdminClient();

  const { error } = await admin
    .from("revenue_requests")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) return { error: error.message };
  return { success: true };
}

export async function approveBonusRequestInternal(requestId) {
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
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", requestId);

  await admin.from("transactions").insert({
    user_id: request.user_id,
    type: "earn",
    amount_coins: coins,
    description: `Бонус: ${request.category}`,
  });

  return { success: true };
}

export async function rejectBonusRequestInternal(requestId) {
  const admin = createAdminClient();

  const { error } = await admin
    .from("bonus_requests")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) return { error: error.message };
  return { success: true };
}

export async function approvePurchaseRequestInternal(requestId) {
  const admin = createAdminClient();

  const { data: purchase } = await admin
    .from("purchase_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!purchase || purchase.status !== "pending") {
    return { error: "Заявка уже обработана" };
  }

  const { error } = await admin
    .from("purchase_requests")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function rejectPurchaseRequestInternal(requestId) {
  const admin = createAdminClient();

  const { data: purchase } = await admin
    .from("purchase_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!purchase || purchase.status !== "pending") {
    return { error: "Заявка уже обработана" };
  }

  const { data: profile } = await admin
    .from("users")
    .select("balance")
    .eq("id", purchase.user_id)
    .single();

  await admin
    .from("users")
    .update({ balance: profile.balance + purchase.price_coins })
    .eq("id", purchase.user_id);

  await admin.from("transactions").insert({
    user_id: purchase.user_id,
    type: "manual_add",
    amount_coins: purchase.price_coins,
    description: "Возврат за отклонённую покупку",
    rating_exempt: true,
  });

  const { error } = await admin
    .from("purchase_requests")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) return { error: error.message };
  return { success: true };
}
