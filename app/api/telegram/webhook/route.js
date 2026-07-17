import { NextResponse } from "next/server";
import {
  approveRevenueRequestInternal,
  rejectRevenueRequestInternal,
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

  if (action === "approve_rev" || action === "reject_rev") {
    const result =
      action === "approve_rev"
        ? await approveRevenueRequestInternal(requestId)
        : await rejectRevenueRequestInternal(requestId);

    if (result.error) {
      await answerCallbackQuery(callback.id, result.error);
      return NextResponse.json({ ok: true });
    }

    const resultLabel =
      action === "approve_rev" ? "✅ Подтверждено" : "❌ Отклонено";

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
