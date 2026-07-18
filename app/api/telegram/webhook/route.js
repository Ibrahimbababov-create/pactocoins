import { NextResponse } from "next/server";
import {
  approveRevenueRequestInternal,
  rejectRevenueRequestInternal,
  approveBonusRequestInternal,
  rejectBonusRequestInternal,
} from "@/lib/telegramApprovals";
import { editTelegramMessage, answerCallbackQuery } from "@/lib/telegramBot";

export async function POST(request) {
  const update = await request.json();

  const callback = update.callback_query;
  if (!callback) {
    return NextResponse.json({ ok: true });
  }

  const chatId = callback.message.chat.id;
  const messageId = callback.message.message_id;
  const data = callback.data || "";

  const [action, requestId] = data.split(":");

  const actionMap = {
    approve_rev: approveRevenueRequestInternal,
    reject_rev: rejectRevenueRequestInternal,
    approve_bonus: approveBonusRequestInternal,
    reject_bonus: rejectBonusRequestInternal,
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
