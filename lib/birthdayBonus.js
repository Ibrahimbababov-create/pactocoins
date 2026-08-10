import { createAdminClient } from "@/lib/supabase-admin";
import { sendTelegramMessage } from "@/lib/telegramBot";
import { nowInAlmaty } from "@/lib/timezone";
import { checkAndApplyLevelUp } from "@/lib/levelUp";

const BIRTHDAY_BONUS_COINS = 3000;
const BIRTHDAY_DESCRIPTION = "С днём рождения!";

export async function processBirthdaysToday() {
  const admin = createAdminClient();
  const { year, month, day } = nowInAlmaty();

  const { data: users } = await admin
    .from("users")
    .select(
      "id, name, balance, total_earned, month_earned, birthday, last_birthday_bonus_year"
    )
    .not("birthday", "is", null);

  const todayBirthdays = (users ?? []).filter((u) => {
    const [, bMonth, bDay] = u.birthday.split("-").map(Number);
    return bMonth === month && bDay === day;
  });

  const results = [];

  for (const u of todayBirthdays) {
    if (u.last_birthday_bonus_year === year) {
      continue; // уже начислено в этом году
    }

    const { error: updateError } = await admin
      .from("users")
      .update({
        balance: u.balance + BIRTHDAY_BONUS_COINS,
        total_earned: u.total_earned + BIRTHDAY_BONUS_COINS,
        month_earned: u.month_earned + BIRTHDAY_BONUS_COINS,
        last_birthday_bonus_year: year,
      })
      .eq("id", u.id);

    if (updateError) {
      console.error(`[birthday] update failed for ${u.id}:`, updateError);
      continue;
    }

    await checkAndApplyLevelUp(u.id, admin);

    await admin.from("transactions").insert({
      user_id: u.id,
      type: "manual_add",
      amount_coins: BIRTHDAY_BONUS_COINS,
      description: BIRTHDAY_DESCRIPTION,
      rating_exempt: true,
    });

    try {
      const groupChatId = process.env.TELEGRAM_ANNOUNCE_CHAT_ID;
      const threadId = process.env.TELEGRAM_ANNOUNCE_THREAD_ID
        ? Number(process.env.TELEGRAM_ANNOUNCE_THREAD_ID)
        : undefined;
      if (groupChatId) {
        await sendTelegramMessage(
          groupChatId,
          `🎉 Сегодня день рождения у ${u.name}! Поздравляем и начисляем ${BIRTHDAY_BONUS_COINS} coins 🎂`,
          undefined,
          threadId
        );
      }
    } catch (err) {
      console.error(`[birthday] telegram notify failed for ${u.id}:`, err);
    }

    results.push(u.name);
  }

  return results;
}
