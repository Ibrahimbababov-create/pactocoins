import { createAdminClient } from "@/lib/supabase-admin";
import { checkAndApplyLevelUp } from "@/lib/levelUp";
import { calculateRevenueCoins } from "@/lib/coinRate";
import { derivePassword } from "@/lib/telegram";
import { notifyUser } from "@/lib/notifyUser";
import { sendTelegramMessage } from "@/lib/telegramBot";

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

  await notifyUser(
    admin,
    request.user_id,
    `✅ Выручка ${request.amount_kzt.toLocaleString("ru-RU")} ₸ подтверждена — +${coins} coins`,
    "notify_requests"
  );

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

  await notifyUser(
    admin,
    request.user_id,
    `✅ Заявка на бонус одобрена — +${coins} coins`,
    "notify_requests"
  );

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

// tg-id того, кто нажал кнопку -> uuid в users (или null)
async function reviewerIdByTelegram(admin, reviewerTgId) {
  if (!reviewerTgId) return null;
  const { data } = await admin
    .from("users")
    .select("id")
    .eq("telegram_id", reviewerTgId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function approvePurchaseRequestInternal(requestId, reviewerTgId) {
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
    .update({
      status: "approved",
      updated_at: new Date().toISOString(),
      reviewed_by: await reviewerIdByTelegram(admin, reviewerTgId),
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) return { error: error.message };

  const { data: reward } = await admin
    .from("rewards")
    .select("title")
    .eq("id", purchase.reward_id)
    .single();

  await notifyUser(
    admin,
    purchase.user_id,
    `✅ Покупка «${reward?.title ?? "награда"}» одобрена`,
    "notify_requests"
  );

  return { success: true };
}

export async function rejectPurchaseRequestInternal(requestId, reviewerTgId) {
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
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
      reviewed_by: await reviewerIdByTelegram(admin, reviewerTgId),
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) return { error: error.message };

  const { data: reward } = await admin
    .from("rewards")
    .select("title")
    .eq("id", purchase.reward_id)
    .single();
  const priceStr = purchase.price_coins?.toLocaleString("ru-RU") ?? "";

  await notifyUser(
    admin,
    purchase.user_id,
    `❌ Покупка «${reward?.title ?? "награда"}» отклонена${
      priceStr ? ` — ${priceStr} coins вернулись на баланс` : ""
    }`,
    "notify_requests"
  );

  return { success: true };
}

export async function approveJoinRequestInternal(requestId) {
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("join_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "pending") {
    return { error: "Заявка уже обработана" };
  }

  const email = `tg${request.telegram_id}@pactocoins.local`;
  const password = derivePassword(request.telegram_id, process.env.TELEGRAM_BOT_TOKEN);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) return { error: createErr.message };

  const { error: insertErr } = await admin.from("users").insert({
    id: created.user.id,
    name: request.name,
    email,
    role: "mop",
    balance: 0,
    total_earned: 0,
    month_earned: 0,
    telegram_id: request.telegram_id,
    birthday: request.birthday ?? null,
  });
  if (insertErr) return { error: insertErr.message };

  await admin
    .from("join_requests")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", requestId);

  try {
    await sendTelegramMessage(
      request.telegram_id,
      "✅ <b>Заявка одобрена!</b>\n\nОткрывай приложение — аккаунт готов, можно заходить."
    );
  } catch (err) {
    console.error("[approveJoin] notify failed:", err);
  }

  return { success: true };
}

export async function rejectJoinRequestInternal(requestId) {
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("join_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "pending") {
    return { error: "Заявка уже обработана" };
  }

  const { error } = await admin
    .from("join_requests")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) return { error: error.message };

  try {
    await sendTelegramMessage(
      request.telegram_id,
      "❌ Заявку на регистрацию отклонили. Если это ошибка — свяжись с администратором."
    );
  } catch (err) {
    console.error("[rejectJoin] notify failed:", err);
  }

  return { success: true };
}
