import { sendTelegramMessage } from "@/lib/telegramBot";

// Личное уведомление сотруднику в Telegram. Тихо выходим, если у
// человека нет telegram_id или отправка не удалась — уведомление не
// должно ронять одобрение заявки.
export async function notifyUser(admin, userId, text) {
  try {
    const { data: profile } = await admin
      .from("users")
      .select("telegram_id")
      .eq("id", userId)
      .single();

    if (!profile?.telegram_id) return;

    await sendTelegramMessage(profile.telegram_id, text);
  } catch (err) {
    console.error(`[notifyUser] failed for ${userId}:`, err);
  }
}
