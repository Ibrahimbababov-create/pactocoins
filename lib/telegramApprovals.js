import { notifyRatingShift } from "@/lib/ratingNotify";
import { formatCoins } from "@/lib/plural";
import { createAdminClient } from "@/lib/supabase-admin";
import { checkAndApplyLevelUp } from "@/lib/levelUp";
import { tieredRevenueCoins, tierForMonth, REVENUE_TIERS } from "@/lib/coinRate";
import { monthRevenueBefore } from "@/lib/revenueMonth";
import { derivePassword } from "@/lib/telegram";
import { creditMentorBonus } from "@/lib/mentorBonus";
import { notifyUser, escapeHtml } from "@/lib/notifyUser";
import { sendTelegramMessage } from "@/lib/telegramBot";
import { maybeGraduateTrainee } from "@/lib/onboarding";
import { almatyDayKey } from "@/lib/timezone";
import { addCoins } from "@/lib/addCoins";

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
    .select("balance, coin_rate_multiplier")
    .eq("id", request.user_id)
    .single();

  // Дата оплаты — та, что выбрал МОП в заявке. Раньше этот путь её не
  // писал вовсе, и у заявок, одобренных кнопкой в Telegram, earned_at
  // оставался пустым (поиск «Оплат» по дате их не находил).
  const earnedAtIso = request.earned_at ?? request.created_at;

  // Ставка по шкале учитывает выручку месяца — как в админке.
  const monthBefore = await monthRevenueBefore(admin, request.user_id, earnedAtIso, requestId);
  const coins = tieredRevenueCoins(request.amount_kzt, profile.coin_rate_multiplier, monthBefore);

  // Сначала «захватываем» заявку: статус меняется, только если она ещё
  // pending. Двойной тап или два админа одновременно — второй получит
  // «уже обработана», а не второе начисление.
  const { data: claimed } = await admin
    .from("revenue_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      credited_coins: coins,
      earned_at: earnedAtIso,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return { error: "Заявка уже обработана" };

  const { error: creditError } = await addCoins(admin, request.user_id, coins);
  if (creditError) {
    await admin
      .from("revenue_requests")
      .update({ status: "pending", reviewed_at: null, credited_coins: null })
      .eq("id", requestId);
    return { error: "Не удалось начислить коины, попробуй ещё раз" };
  }

  // Процент наставнику за оплату подопечного.
  await creditMentorBonus(admin, { ...request, status: "approved", earned_at: earnedAtIso });

  const transactionPayload = {
    user_id: request.user_id,
    type: "earn",
    amount_coins: coins,
    description: `Выручка подтверждена: ${request.amount_kzt.toLocaleString(
      "ru-RU"
    )} ₸`,
  };
  // Оплата задним числом — начисление тем же днём, как в админке.
  if (almatyDayKey(earnedAtIso) !== almatyDayKey(new Date())) {
    transactionPayload.created_at = earnedAtIso;
  }
  await admin.from("transactions").insert(transactionPayload);

  await checkAndApplyLevelUp(request.user_id, admin);

  let revenueText = `✅ Выручка ${request.amount_kzt.toLocaleString("ru-RU")} ₸ подтверждена — +${formatCoins(coins)}`;
  // Сработала повышенная ставка шкалы — пусть человек это увидит.
  const monthNow = monthBefore + request.amount_kzt;
  if (monthNow > REVENUE_TIERS[1].from) {
    const { rate } = tierForMonth(monthNow);
    revenueText += `\n🔥 За месяц уже ${monthNow.toLocaleString("ru-RU")} ₸ — ставка ${rate} коина за 1000 ₸`;
  }
  await notifyUser(
    admin,
    request.user_id,
    request.admin_reply_comment?.trim()
      ? `${revenueText}\n\n💬 ${escapeHtml(request.admin_reply_comment.trim())}`
      : revenueText,
    "notify_requests"
  );

  await notifyRatingShift(admin, {
    userId: request.user_id,
    amountKzt: request.amount_kzt,
    earnedAtIso,
  });

  await maybeGraduateTrainee(admin, request.user_id);

  return { success: true };
}

export async function rejectRevenueRequestInternal(requestId) {
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("revenue_requests")
    .select("user_id, status, admin_reply_comment")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "pending") {
    return { error: "Заявка уже обработана" };
  }

  const { error } = await admin
    .from("revenue_requests")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) return { error: error.message };

  const revenueRejectText = "❌ Заявка на выручку отклонена";
  await notifyUser(
    admin,
    request.user_id,
    request.admin_reply_comment?.trim()
      ? `${revenueRejectText}\n\n💬 ${escapeHtml(request.admin_reply_comment.trim())}`
      : revenueRejectText,
    "notify_requests"
  );

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

  // «Приход вовремя» — награда не coins, а крутка на колесе фортуны.
  const spinOnly = request.category === "attendance";
  const coins = spinOnly ? 0 : request.amount_coins;

  // Сначала «захватываем» заявку: статус меняется, только если она ещё
  // pending. Двойной тап или два админа одновременно — второй получит
  // «уже обработана», а не второе начисление.
  const { data: claimed } = await admin
    .from("bonus_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      credited_coins: coins,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return { error: "Заявка уже обработана" };

  if (!spinOnly) {
    const { data: profile } = await admin
      .from("users")
      .select("balance")
      .eq("id", request.user_id)
      .single();

    const { error: creditError } = await addCoins(admin, request.user_id, coins);
    if (creditError) {
      await admin
        .from("bonus_requests")
        .update({ status: "pending", reviewed_at: null, credited_coins: null })
        .eq("id", requestId);
      return { error: "Не удалось начислить коины, попробуй ещё раз" };
    }
  }

  if (!spinOnly) {
    await admin.from("transactions").insert({
      user_id: request.user_id,
      type: "earn",
      amount_coins: coins,
      description: `Бонус: ${request.category}`,
      // Бонусы в рейтинг не идут — как в админке.
      rating_exempt: true,
    });

    await checkAndApplyLevelUp(request.user_id, admin);

    const bonusText = `✅ Заявка на бонус одобрена — +${formatCoins(coins)}`;
    await notifyUser(
      admin,
      request.user_id,
      request.admin_reply_comment?.trim()
        ? `${bonusText}\n\n💬 ${escapeHtml(request.admin_reply_comment.trim())}`
        : bonusText,
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
      request.admin_reply_comment?.trim()
        ? `${spinText}\n\n💬 ${escapeHtml(request.admin_reply_comment.trim())}`
        : spinText,
      "notify_requests"
    );
  }

  return { success: true };
}

export async function rejectBonusRequestInternal(requestId) {
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("bonus_requests")
    .select("user_id, status, admin_reply_comment")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "pending") {
    return { error: "Заявка уже обработана" };
  }

  const { error } = await admin
    .from("bonus_requests")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) return { error: error.message };

  const bonusRejectText = "❌ Заявка на бонус отклонена";
  await notifyUser(
    admin,
    request.user_id,
    request.admin_reply_comment?.trim()
      ? `${bonusRejectText}\n\n💬 ${escapeHtml(request.admin_reply_comment.trim())}`
      : bonusRejectText,
    "notify_requests"
  );

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

  const { data: claimed, error } = await admin
    .from("purchase_requests")
    .update({
      status: "approved",
      updated_at: new Date().toISOString(),
      reviewed_by: await reviewerIdByTelegram(admin, reviewerTgId),
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");

  if (error) return { error: error.message };
  if (!claimed?.length) return { error: "Заявка уже обработана" };

  const { data: reward } = await admin
    .from("rewards")
    .select("title")
    .eq("id", purchase.reward_id)
    .single();

  let approveText = `✅ Покупка «${reward?.title ?? "награда"}» одобрена`;
  if (purchase.admin_reply_comment?.trim()) {
    approveText += `\n\n💬 ${escapeHtml(purchase.admin_reply_comment.trim())}`;
  }
  await notifyUser(admin, purchase.user_id, approveText, "notify_requests");

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

  // Сначала статус (только если ещё pending), потом возврат — иначе
  // двойной тап вернул бы коины дважды.
  const { data: claimed, error } = await admin
    .from("purchase_requests")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
      reviewed_by: await reviewerIdByTelegram(admin, reviewerTgId),
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");

  if (error) return { error: error.message };
  if (!claimed?.length) return { error: "Заявка уже обработана" };

  const { data: profile } = await admin
    .from("users")
    .select("balance")
    .eq("id", purchase.user_id)
    .single();

  await addCoins(admin, purchase.user_id, purchase.price_coins);

  await admin.from("transactions").insert({
    user_id: purchase.user_id,
    type: "manual_add",
    amount_coins: purchase.price_coins,
    description: "Возврат за отклонённую покупку",
    rating_exempt: true,
  });

  const { data: reward } = await admin
    .from("rewards")
    .select("title")
    .eq("id", purchase.reward_id)
    .single();
  let rejectText = `❌ Покупка «${reward?.title ?? "награда"}» отклонена${
    purchase.price_coins ? ` — ${formatCoins(purchase.price_coins)} вернулись на баланс` : ""
  }`;
  if (purchase.admin_reply_comment?.trim()) {
    rejectText += `\n\n💬 ${escapeHtml(purchase.admin_reply_comment.trim())}`;
  }

  await notifyUser(admin, purchase.user_id, rejectText, "notify_requests");

  return { success: true };
}

export async function approveJoinRequestInternal(requestId, comment) {
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
    role: "trainee",
    level: 0,
    balance: 0,
    telegram_id: request.telegram_id,
    birthday: request.birthday ?? null,
    rop_id: request.rop_id ?? null,
    mentor_id: request.mentor_id ?? null,
  });
  if (insertErr) return { error: insertErr.message };

  await admin
    .from("join_requests")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", requestId);

  try {
    const finalComment = comment ?? request.admin_reply_comment;
    let text = "✅ <b>Заявка одобрена!</b>\n\nОткрывай приложение — аккаунт готов, можно заходить.";
    if (finalComment?.trim()) text += `\n\n💬 ${escapeHtml(finalComment.trim())}`;
    await sendTelegramMessage(request.telegram_id, text);
  } catch (err) {
    console.error("[approveJoin] notify failed:", err);
  }

  return { success: true };
}

export async function rejectJoinRequestInternal(requestId, comment) {
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
    const finalComment = comment ?? request.admin_reply_comment;
    let text = "❌ Заявку на регистрацию отклонили. Если это ошибка — свяжись с администратором.";
    if (finalComment?.trim()) text += `\n\n💬 ${escapeHtml(finalComment.trim())}`;
    await sendTelegramMessage(request.telegram_id, text);
  } catch (err) {
    console.error("[rejectJoin] notify failed:", err);
  }

  return { success: true };
}
