"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { getEffectivePrice } from "@/lib/rewardPricing";

export async function purchaseReward(rewardId) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("users")
    .select("balance")
    .eq("id", user.id)
    .single();

  const { data: reward } = await admin
    .from("rewards")
    .select("*")
    .eq("id", rewardId)
    .single();

  if (!reward || !reward.is_active) {
    return { error: "Награда недоступна" };
  }

  const { effectivePrice } = getEffectivePrice(reward);

  if (profile.balance < effectivePrice) {
    return { error: "Недостаточно коинов" };
  }

  const newBalance = profile.balance - effectivePrice;

  const { error: balanceError } = await admin
    .from("users")
    .update({ balance: newBalance })
    .eq("id", user.id);

  if (balanceError) return { error: "Ошибка списания баланса" };

  const { error: purchaseError } = await admin
    .from("purchase_requests")
    .insert({
      user_id: user.id,
      reward_id: rewardId,
      price_coins: effectivePrice,
      status: "pending",
    });

  if (purchaseError) return { error: "Ошибка создания заявки" };

  await admin.from("transactions").insert({
    user_id: user.id,
    type: "spend",
    amount_coins: -effectivePrice,
    description: `Покупка: ${reward.title}`,
    created_by: user.id,
  });

  revalidatePath("/mop");
  revalidatePath("/mop/shop");
  revalidatePath("/mop/purchases");

  return { success: true };
}

export async function purchaseVariableReward(rewardId, kztAmount) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const kzt = Number(kztAmount);
  if (!Number.isFinite(kzt) || kzt <= 0) {
    return { error: "Укажи сумму больше нуля" };
  }

  const admin = createAdminClient();

  const { data: reward } = await admin
    .from("rewards")
    .select("*")
    .eq("id", rewardId)
    .single();

  if (!reward || !reward.is_active || !reward.is_variable) {
    return { error: "Награда недоступна" };
  }

  const priceCoins = Math.ceil((kzt * reward.rate_coins) / reward.rate_kzt);

  const { data: profile } = await admin
    .from("users")
    .select("balance")
    .eq("id", user.id)
    .single();

  if (profile.balance < priceCoins) {
    return { error: "Недостаточно коинов" };
  }

  const newBalance = profile.balance - priceCoins;

  const { error: balanceError } = await admin
    .from("users")
    .update({ balance: newBalance })
    .eq("id", user.id);

  if (balanceError) return { error: "Ошибка списания баланса" };

  const { error: purchaseError } = await admin
    .from("purchase_requests")
    .insert({
      user_id: user.id,
      reward_id: rewardId,
      price_coins: priceCoins,
      kzt_amount: kzt,
      status: "pending",
    });

  if (purchaseError) return { error: "Ошибка создания заявки" };

  await admin.from("transactions").insert({
    user_id: user.id,
    type: "spend",
    amount_coins: -priceCoins,
    description: `Покупка: ${reward.title} — ${kzt.toLocaleString("ru-RU")} ₸`,
    created_by: user.id,
  });

  revalidatePath("/mop");
  revalidatePath("/mop/shop");
  revalidatePath("/mop/purchases");

  return { success: true, priceCoins };
}
