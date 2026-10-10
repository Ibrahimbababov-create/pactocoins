import { formatCoins } from "@/lib/plural";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendTelegramMessage } from "@/lib/telegramBot";
import { escapeHtml } from "@/lib/notifyUser";
import { nowInAlmaty } from "@/lib/timezone";
import { checkAndApplyLevelUp } from "@/lib/levelUp";

const BIRTHDAY_BONUS_COINS = 3000;
const BIRTHDAY_DESCRIPTION = "С днём рождения!";

export async function processBirthdaysToday() {
  const admin = createAdminClient();
  const { year, month, day } = nowInAlmaty();

  // Только те, кто сейчас в компании: уволенному коины не начисляем и
  // тем более не поздравляем его от лица команды в общем чате. Гость и
  // тестовые аккаунты сюда тоже не должны попадать.
  const { data: users } = await admin
    .from("users")
    .select("id, name, balance, birthday, last_birthday_bonus_year")
    .not("birthday", "is", null)
    .eq("is_active", true)
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local");

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
        last_birthday_bonus_year: year,
      })
      .eq("id", u.id);

    if (updateError) {
      console.error(`[birthday] update failed for ${u.id}:`, updateError);
      continue;
    }

    await admin.from("transactions").insert({
      user_id: u.id,
      type: "manual_add",
      amount_coins: BIRTHDAY_BONUS_COINS,
      description: BIRTHDAY_DESCRIPTION,
      rating_exempt: true,
    });

    await checkAndApplyLevelUp(u.id, admin);

    try {
      const groupChatId = process.env.TELEGRAM_ANNOUNCE_CHAT_ID;
      const threadId = process.env.TELEGRAM_ANNOUNCE_THREAD_ID
        ? Number(process.env.TELEGRAM_ANNOUNCE_THREAD_ID)
        : undefined;
      if (groupChatId) {
        await sendTelegramMessage(
          groupChatId,
          `🎉 Сегодня день рождения у ${escapeHtml(u.name)}! Поздравляем и начисляем ${formatCoins(BIRTHDAY_BONUS_COINS)} 🎂`,
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
