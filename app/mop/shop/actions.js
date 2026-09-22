"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { getEffectivePrice } from "@/lib/rewardPricing";
import { sendTelegramMessage } from "@/lib/telegramBot";
import { recordTeamEvent } from "@/lib/teamEvents";
import { spendCoins } from "@/lib/spendCoins";
import { escapeHtml } from "@/lib/notifyUser";

async function notifyPurchaseGroup(admin, purchaseId, employeeName, text) {
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!groupChatId) return;

  const threadId = process.env.TELEGRAM_PURCHASES_THREAD_ID
    ? Number(process.env.TELEGRAM_PURCHASES_THREAD_ID)
    : undefined;

  const tgResult = await sendTelegramMessage(
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

  // Message id нужен, чтобы потом узнать реплай админа на это
  // сообщение и подтянуть его текст как комментарий к одобрению.
  if (tgResult?.result?.message_id) {
    await admin
      .from("purchase_requests")
      .update({
        admin_chat_id: groupChatId,
        admin_message_id: tgResult.result.message_id,
      })
      .eq("id", purchaseId);
  }
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
    .select("name, balance, is_guest")
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

  const spent = await spendCoins(admin, user.id, effectivePrice);
  if (!spent.ok) return { error: spent.error };

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

  if (!profile?.is_guest) {
    await recordTeamEvent(admin, {
      userId: user.id,
      userName: profile?.name ?? "Кто-то",
      kind: "purchase",
      title: reward.title,
      icon: "🛍",
    });
  }

  await notifyPurchaseGroup(
    admin,
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

// Награда с вариантами (барбер по бюджету, сертификаты по номиналу и т.п.) —
// сама карточка одна, цену определяет выбранный внутри вариант.
export async function purchaseRewardVariant(variantId) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("users")
    .select("name, balance, is_guest")
    .eq("id", user.id)
    .single();

  const { data: variant } = await admin
    .from("reward_variants")
    .select("*, rewards(*)")
    .eq("id", variantId)
    .single();

  if (!variant || !variant.rewards || !variant.rewards.is_active) {
    return { error: "Награда недоступна" };
  }

  const reward = variant.rewards;
  const price = variant.price_coins;

  const spent = await spendCoins(admin, user.id, price);
  if (!spent.ok) return { error: spent.error };

  const { data: inserted, error: purchaseError } = await admin
    .from("purchase_requests")
    .insert({
      user_id: user.id,
      reward_id: reward.id,
      price_coins: price,
      variant_label: variant.label,
      status: "pending",
    })
    .select()
    .single();

  if (purchaseError) return { error: "Ошибка создания заявки" };

  await admin.from("transactions").insert({
    user_id: user.id,
    type: "spend",
    amount_coins: -price,
    description: `Покупка: ${reward.title} — ${variant.label}`,
    created_by: user.id,
  });

  if (!profile?.is_guest) {
    await recordTeamEvent(admin, {
      userId: user.id,
      userName: profile?.name ?? "Кто-то",
      kind: "purchase",
      title: `${reward.title} — ${variant.label}`,
      icon: "🛍",
    });
  }

  await notifyPurchaseGroup(
    admin,
    inserted.id,
    profile?.name ?? "МОП",
    `Награда: ${reward.title} — ${variant.label}\nЦена: ${price} coins`
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
    .select("name, balance, is_guest")
    .eq("id", user.id)
    .single();

  const spent = await spendCoins(admin, user.id, priceCoins);
  if (!spent.ok) return { error: spent.error };

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

  if (!profile?.is_guest) {
    await recordTeamEvent(admin, {
      userId: user.id,
      userName: profile?.name ?? "Кто-то",
      kind: "purchase",
      title: reward.title,
      icon: "🛍",
    });
  }

  await notifyPurchaseGroup(
    admin,
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

// ---------- Свои предложения в магазин ----------

export async function submitRewardSuggestion(title, priceCoins, description, imageUrl) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const cleanTitle = (title || "").trim();
  if (!cleanTitle) return { error: "Укажи название" };

  const price = Math.floor(Number(priceCoins));
  if (!price || price <= 0) return { error: "Укажи цену в coins" };

  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .single();

  const { error } = await supabase.from("reward_suggestions").insert({
    user_id: user.id,
    title: cleanTitle,
    price_coins: price,
    description: (description || "").trim() || null,
    image_url: imageUrl || null,
  });

  if (error) return { error: "Не удалось отправить предложение" };

  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (groupChatId) {
    const threadId = process.env.TELEGRAM_REQUESTS_THREAD_ID
      ? Number(process.env.TELEGRAM_REQUESTS_THREAD_ID)
      : undefined;
    await sendTelegramMessage(
      groupChatId,
      `💡 <b>Предложение в магазин</b>\n\nОт: <b>${escapeHtml(profile?.name ?? "МОП")}</b>\n«${escapeHtml(cleanTitle)}» — ${price} coins${
        description ? `\n${escapeHtml(description)}` : ""
      }\n\nПосмотреть: https://pactocoins.vercel.app/admin/reward-suggestions`,
      undefined,
      threadId
    );
  }

  revalidatePath("/mop/shop");
  revalidatePath("/admin/reward-suggestions");
  return { success: true };
}
