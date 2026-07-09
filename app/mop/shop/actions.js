"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function purchaseReward(rewardId) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const { data: profile } = await supabase
    .from("users")
    .select("balance")
    .eq("id", user.id)
    .single();

  const { data: reward } = await supabase
    .from("rewards")
    .select("*")
    .eq("id", rewardId)
    .single();

  if (!reward || !reward.is_active) {
    return { error: "Награда недоступна" };
  }

  if (profile.balance < reward.price_coins) {
    return { error: "Недостаточно коинов" };
  }

  const newBalance = profile.balance - reward.price_coins;

  const { error: balanceError } = await supabase
    .from("users")
    .update({ balance: newBalance })
    .eq("id", user.id);

  if (balanceError) return { error: "Ошибка списания баланса" };

  const { error: purchaseError } = await supabase
    .from("purchase_requests")
    .insert({
      user_id: user.id,
      reward_id: rewardId,
      price_coins: reward.price_coins,
      status: "pending",
    });

  if (purchaseError) return { error: "Ошибка создания заявки" };

  await supabase.from("transactions").insert({
    user_id: user.id,
    type: "spend",
    amount_coins: -reward.price_coins,
    description: `Покупка: ${reward.title}`,
    created_by: user.id,
  });

  revalidatePath("/mop");
  revalidatePath("/mop/shop");
  revalidatePath("/mop/purchases");

  return { success: true };
}
