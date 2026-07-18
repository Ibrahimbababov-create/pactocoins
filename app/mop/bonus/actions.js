"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";
import { sendTelegramMessage } from "@/lib/telegramBot";

const MAX_CUSTOM_AMOUNT = 20000;

export async function submitBonusRequest(category, comment, customAmount) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const meta = BONUS_CATEGORIES[category];
  if (!meta) return { error: "Неизвестная категория" };

  let amount = meta.amount;

  if (amount === null) {
    const parsed = Number(customAmount);
    if (!parsed || parsed <= 0) {
      return { error: "Укажи количество coins" };
    }
    if (parsed > MAX_CUSTOM_AMOUNT) {
      return { error: `Максимум ${MAX_CUSTOM_AMOUNT} coins за раз` };
    }
    amount = Math.floor(parsed);

    if (!comment || comment.trim().length < 3) {
      return { error: "Опиши, что именно сделал" };
    }
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .single();

  const { data: inserted, error } = await supabase
    .from("bonus_requests")
    .insert({
      user_id: user.id,
      category,
      amount_coins: amount,
      comment,
      status: "pending",
    })
    .select()
    .single();

  if (error) return { error: "Не удалось отправить заявку" };

  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;

  if (groupChatId) {
    const text =
      `🎯 <b>Новая заявка на бонус</b>\n\n` +
      `От: <b>${profile?.name ?? "МОП"}</b>\n` +
      `Повод: ${meta.label}\n` +
      `Коинов: ${amount}\n` +
      (comment ? `Комментарий: ${comment}\n` : "");

    await sendTelegramMessage(groupChatId, text, {
      inline_keyboard: [
        [
          {
            text: "✅ Подтвердить",
            callback_data: `approve_bonus:${inserted.id}`,
          },
          {
            text: "❌ Отклонить",
            callback_data: `reject_bonus:${inserted.id}`,
          },
        ],
      ],
    });
  }

  revalidatePath("/mop");
  revalidatePath("/admin/bonus-requests");
  return { success: true };
}
