import { sendTelegramMessage } from "@/lib/telegramBot";
import { keepGroupMembers } from "@/lib/teamGroup";

const PREF_COLUMNS = new Set([
  "notify_requests",
  "notify_shop",
  "notify_goal",
  "notify_rating",
]);

// Личное уведомление сотруднику в Telegram. Тихо выходим, если у
// человека нет telegram_id, отправка не удалась, или он отключил этот
// тип уведомлений (prefKey — колонка notify_* в users). Уведомление не
// должно ронять одобрение заявки.
export async function notifyUser(admin, userId, text, prefKey) {
  try {
    const cols = ["telegram_id"];
    if (prefKey && PREF_COLUMNS.has(prefKey)) cols.push(prefKey);

    const { data: profile } = await admin
      .from("users")
      .select(cols.join(", "))
      .eq("id", userId)
      .single();

    if (!profile?.telegram_id) return;
    if (prefKey && PREF_COLUMNS.has(prefKey) && profile[prefKey] === false) return;

    await sendTelegramMessage(profile.telegram_id, text);
  } catch (err) {
    console.error(`[notifyUser] failed for ${userId}:`, err);
  }
}

// Рассылка одного текста всем активным МОПам/РОПам, у кого включён
// данный тип уведомлений. Гостя и тестовые аккаунты пропускаем.
export async function notifyManyUsers(admin, text, prefKey) {
  try {
    let query = admin
      .from("users")
      .select("telegram_id")
      .not("telegram_id", "is", null)
      .eq("is_active", true)
      .eq("is_guest", false)
      .in("role", ["mop", "rop"])
      .not("email", "like", "%.test@pactocoins.local");

    if (prefKey && PREF_COLUMNS.has(prefKey)) query = query.eq(prefKey, true);

    const { data: users } = await query;
    if (!users?.length) return;

    // Только те, кто в рабочей группе.
    const inGroup = await keepGroupMembers(users.map((u) => u.telegram_id));
    const recipients = users.filter((u) => inGroup.has(String(u.telegram_id)));
    if (!recipients.length) return;

    await Promise.allSettled(
      recipients.map((u) => sendTelegramMessage(u.telegram_id, text))
    );
  } catch (err) {
    console.error("[notifyManyUsers] failed:", err);
  }
}
