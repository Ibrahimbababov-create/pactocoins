"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { sendTelegramMessage } from "@/lib/telegramBot";

export async function submitRevenueRequest(amountKzt, comment, receiptConfirmed) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  if (!amountKzt || amountKzt <= 0) {
    return { error: "Некорректная сумма" };
  }

  if (!receiptConfirmed) {
    return { error: "Подтверди, что отправил чек в группу" };
  }

  const coins = Math.floor(amountKzt / 1000);

  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .single();

  const { data: inserted, error } = await supabase
    .from("revenue_requests")
    .insert({
      user_id: user.id,
      amount_kzt: amountKzt,
      calculated_coins: coins,
      comment,
      receipt_confirmed: true,
      status: "pending",
    })
    .select()
    .single();

  if (error) return { error: "Не удалось отправить заявку" };

  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;

  if (groupChatId) {
    const text =
      `💰 <b>Новая заявка на выручку</b>\n\n` +
      `От: <b>${profile?.name ?? "МОП"}</b>\n` +
      `Сумма: ${amountKzt.toLocaleString("ru-RU")} ₸\n` +
      `Коинов: ${coins}\n` +
      (comment ? `Комментарий: ${comment}\n` : "");

    await sendTelegramMessage(groupChatId, text, {
      inline_keyboard: [
        [
          { text: "✅ Подтвердить", callback_data: `approve_rev:${inserted.id}` },
          { text: "❌ Отклонить", callback_data: `reject_rev:${inserted.id}` },
        ],
      ],
    });
  }

  revalidatePath("/mop");
  return { success: true };
}
