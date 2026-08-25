"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { getEffectivePrice } from "@/lib/rewardPricing";
import { sendTelegramMessage } from "@/lib/telegramBot";

async function notifyPurchaseGroup(purchaseId, employeeName, text) {
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!groupChatId) return;

  const threadId = process.env.TELEGRAM_PURCHASES_THREAD_ID
    ? Number(process.env.TELEGRAM_PURCHASES_THREAD_ID)
    : undefined;

  await sendTelegramMessage(
    groupChatId,
    `🛍 <b>Новая покупка</b>\n\nОт: <b>${employeeName}</b>\n${text}`,
    {
      inline_keyboard: [
        [
          { text: "✅ Подтвердить", callback_data: `approve_purchase:${purchaseId}` },
          { text: "❌ Отклонить", callback_data: `reject_purchase:${purchaseId}` },
        ],
      ],
    },
    threadId
  );
}

export async function purchaseReward(rewardId) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("users")
    .select("name, balance")
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

  const { data: inserted, error: purchaseError } = await admin
    .from("purchase_requests")
    .insert({
      user_id: user.id,
      reward_id: rewardId,
      price_coins: effectivePrice,
      status: "pending",
    })
    .select()
    .single();

  if (purchaseError) return { error: "Ошибка создания заявки" };

  await admin.from("transactions").insert({
    user_id: user.id,
    type: "spend",
    amount_coins: -effectivePrice,
    description: `Покупка: ${reward.title}`,
    created_by: user.id,
  });

  await notifyPurchaseGroup(
    inserted.id,
    profile?.name ?? "МОП",
    `Награда: ${reward.title}\nЦена: ${effectivePrice} coins`
  );

  revalidatePath("/mop");
  revalidatePath("/mop/shop");
  revalidatePath("/mop/purchases");
  revalidatePath("/observer");
  revalidatePath("/observer/shop");

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
    .select("name, balance")
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

  const { data: inserted, error: purchaseError } = await admin
    .from("purchase_requests")
    .insert({
      user_id: user.id,
      reward_id: rewardId,
      price_coins: priceCoins,
      kzt_amount: kzt,
      status: "pending",
    })
    .select()
    .single();

  if (purchaseError) return { error: "Ошибка создания заявки" };

  await admin.from("transactions").insert({
    user_id: user.id,
    type: "spend",
    amount_coins: -priceCoins,
    description: `Покупка: ${reward.title} — ${kzt.toLocaleString("ru-RU")} ₸`,
    created_by: user.id,
  });

  await notifyPurchaseGroup(
    inserted.id,
    profile?.name ?? "МОП",
    `Награда: ${reward.title}\nСумма: ${kzt.toLocaleString("ru-RU")} ₸\nЦена: ${priceCoins} coins`
  );

  revalidatePath("/mop");
  revalidatePath("/mop/shop");
  revalidatePath("/mop/purchases");
  revalidatePath("/observer");
  revalidatePath("/observer/shop");

  return { success: true, priceCoins };
}
