import { LEVELS, getLevelForAmount } from "@/lib/levels";
import { sendTelegramMessage } from "@/lib/telegramBot";

// Суммы наград ещё не финальные (плюс нужно отдельно решить, что
// делать с теми, кто уже прошёл несколько уровней до включения этой
// фичи — им бы разом выдало награды за все пропущенные уровни).
// Пока выключено: звание считается и поздравление шлётся как обычно,
// coins просто не начисляются. Включить обратно — поменять на true.
const REWARDS_ENABLED = false;

// Проверяет, поднялся ли пользователь на новый уровень после начисления,
// и если да — выдаёт награду (если объявлена и включена) и поздравляет
// в группе. Вызывать ПОСЛЕ того, как users.total_earned уже обновлён
// в базе — функция сама перечитывает свежие данные.
export async function checkAndApplyLevelUp(userId, admin) {
  const { data: profile } = await admin
    .from("users")
    .select("name, balance, total_earned, month_earned, last_level_id")
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

  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;

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
      if (groupChatId) {
        await sendTelegramMessage(
          groupChatId,
          `🎉 ${profile.name} достиг звания ${level.icon} ${level.name}!`
        );
      }
    } catch (err) {
      console.error(`[levelUp] telegram notify failed for ${userId}:`, err);
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
