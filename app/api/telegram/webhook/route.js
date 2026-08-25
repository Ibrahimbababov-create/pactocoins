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
import { editTelegramMessage, answerCallbackQuery } from "@/lib/telegramBot";

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
