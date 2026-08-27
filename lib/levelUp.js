import { LEVELS, getLevelForAmount } from "@/lib/levels";
import { sendTelegramMessage } from "@/lib/telegramBot";
import { recordTeamEvent } from "@/lib/teamEvents";

// Суммы наград ещё не финальные (плюс нужно отдельно решить, что
// делать с теми, кто уже прошёл несколько уровней до включения этой
// фичи — им бы разом выдало награды за все пропущенные уровни).
// Пока выключено: звание считается и поздравление шлётся как обычно,
// coins просто не начисляются. Включить обратно — поменять на true.
const REWARDS_ENABLED = false;

// Выключено по просьбе: при первом включении фичи у людей, кто уже
// прошёл несколько уровней, всем разом посыпятся поздравления в общий
// чат — сначала нужно спокойно сообщить о фиче. last_level_id всё равно
// обновляется молча, чтобы потом при включении не было задвоенного шквала.
// Включить обратно — поменять на true.
const ANNOUNCE_ENABLED = false;

// Проверяет, поднялся ли пользователь на новый уровень после начисления,
// и если да — выдаёт награду (если объявлена и включена) и поздравляет
// в группе. Вызывать ПОСЛЕ того, как users.total_earned уже обновлён
// в базе — функция сама перечитывает свежие данные.
export async function checkAndApplyLevelUp(userId, admin) {
  const { data: profile } = await admin
    .from("users")
    .select("name, balance, total_earned, month_earned, last_level_id, is_guest")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const currentLevelId = profile.last_level_id ?? 1;
  const newLevel = getLevelForAmount(profile.total_earned);

  if (newLevel.id <= currentLevelId) return;

  // Могли перескочить сразу несколько уровней за одно начисление —
  // выдаём награды и поздравления за каждый пройденный по очереди.
  const passedLevels = LEVELS.filter(
    (l) => l.id > currentLevelId && l.id <= newLevel.id
  ).sort((a, b) => a.id - b.id);

  let balance = profile.balance;
  let totalEarned = profile.total_earned;
  let monthEarned = profile.month_earned;

  const groupChatId = process.env.TELEGRAM_ANNOUNCE_CHAT_ID;
  const threadId = process.env.TELEGRAM_ANNOUNCE_THREAD_ID
    ? Number(process.env.TELEGRAM_ANNOUNCE_THREAD_ID)
    : undefined;

  for (const level of passedLevels) {
    if (REWARDS_ENABLED && level.reward) {
      balance += level.reward;
      totalEarned += level.reward;
      monthEarned += level.reward;

      await admin.from("transactions").insert({
        user_id: userId,
        type: "manual_add",
        amount_coins: level.reward,
        description: `Новое звание: ${level.name}!`,
        rating_exempt: true,
      });
    }

    try {
      if (ANNOUNCE_ENABLED && groupChatId) {
        await sendTelegramMessage(
          groupChatId,
          `🎉 ${profile.name} достиг звания ${level.icon} ${level.name}!`,
          undefined,
          threadId
        );
      }
    } catch (err) {
      console.error(`[levelUp] telegram notify failed for ${userId}:`, err);
    }

    if (!profile.is_guest) {
      await recordTeamEvent(admin, {
        userId,
        userName: profile.name,
        kind: "level_up",
        title: level.name,
        icon: level.icon,
      });
    }
  }

  await admin
    .from("users")
    .update({
      balance,
      total_earned: totalEarned,
      month_earned: monthEarned,
      last_level_id: newLevel.id,
    })
    .eq("id", userId);
}
