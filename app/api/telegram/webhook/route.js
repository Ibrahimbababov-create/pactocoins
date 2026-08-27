import { NextResponse } from "next/server";
import {
  approveRevenueRequestInternal,
  rejectRevenueRequestInternal,
  approveBonusRequestInternal,
  rejectBonusRequestInternal,
  approvePurchaseRequestInternal,
  rejectPurchaseRequestInternal,
  approveJoinRequestInternal,
  rejectJoinRequestInternal,
} from "@/lib/telegramApprovals";
import {
  editTelegramMessage,
  answerCallbackQuery,
  sendTelegramMessage,
  sendTelegramPhoto,
} from "@/lib/telegramBot";
import { createAdminClient } from "@/lib/supabase-admin";
import { renderRatingImage } from "@/lib/ratingImage";

const RATING_CMDS = new Set(["/rating", "/rating_week", "/rating_month"]);

async function handleRatingCommand(msg, cmd) {
  const admin = createAdminClient();

  const { data: caller } = await admin
    .from("users")
    .select("role")
    .eq("telegram_id", msg.from?.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!caller) {
    await sendTelegramMessage(msg.chat.id, "Команда доступна только админам.");
    return;
  }

  const period = cmd === "/rating_month" ? "month" : "week";
  try {
    const png = await renderRatingImage(admin, period);
    await sendTelegramPhoto(
      msg.chat.id,
      png,
      `🏆 Рейтинг · ${period === "month" ? "месяц" : "неделя"}`,
      "image/png"
    );
  } catch (err) {
    console.error("[rating cmd] failed:", err);
    await sendTelegramMessage(msg.chat.id, "Не получилось собрать картинку рейтинга.");
  }
}

const COIN_ACTIONS = new Set([
  "approve_rev",
  "reject_rev",
  "approve_bonus",
  "reject_bonus",
  "approve_purchase",
  "reject_purchase",
  "approve_join",
  "reject_join",
]);

async function forwardToSalesBot(update) {
  const baseUrl = process.env.SALES_BOT_URL;
  if (!baseUrl) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    await fetch(`${baseUrl}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": process.env.SALES_BOT_SECRET || "",
      },
      body: JSON.stringify(update),
      signal: controller.signal,
    });
  } catch (err) {
    console.error("Failed to forward update to sales-bot:", err);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request) {
  const update = await request.json();

  // Команды бота на картинку рейтинга (только для админов).
  const text = update.message?.text;
  if (text) {
    const cmd = text
      .trim()
      .split(/\s+/)[0]
      .toLowerCase()
      .replace(/@[a-z0-9_]+$/i, "");
    if (RATING_CMDS.has(cmd)) {
      await handleRatingCommand(update.message, cmd);
      return NextResponse.json({ ok: true });
    }
  }

  const callback = update.callback_query;
  const data = callback?.data || "";
  const [action, requestId] = data.split(":");

  if (!callback || !COIN_ACTIONS.has(action)) {
    await forwardToSalesBot(update);
    return NextResponse.json({ ok: true });
  }

  const chatId = callback.message.chat.id;
  const messageId = callback.message.message_id;

  const actionMap = {
    approve_rev: approveRevenueRequestInternal,
    reject_rev: rejectRevenueRequestInternal,
    approve_bonus: approveBonusRequestInternal,
    reject_bonus: rejectBonusRequestInternal,
    approve_purchase: approvePurchaseRequestInternal,
    reject_purchase: rejectPurchaseRequestInternal,
    approve_join: approveJoinRequestInternal,
    reject_join: rejectJoinRequestInternal,
  };

  const handler = actionMap[action];

  if (handler) {
    const result = await handler(requestId);

    if (result.error) {
      await answerCallbackQuery(callback.id, result.error);
      return NextResponse.json({ ok: true });
    }

    const resultLabel = action.startsWith("approve")
      ? "✅ Подтверждено"
      : "❌ Отклонено";

    const actorName =
      callback.from.first_name +
      (callback.from.last_name ? ` ${callback.from.last_name}` : "");

    await editTelegramMessage(
      chatId,
      messageId,
      `${callback.message.text}\n\n<b>${resultLabel}</b> (${actorName})`
    );

    await answerCallbackQuery(callback.id, resultLabel);
  }

  return NextResponse.json({ ok: true });
}
