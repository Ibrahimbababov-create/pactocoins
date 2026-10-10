import { formatCoins } from "@/lib/plural";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendTelegramMessage } from "@/lib/telegramBot";
import { escapeHtml } from "@/lib/notifyUser";
import { nowInAlmaty } from "@/lib/timezone";
import { checkAndApplyLevelUp } from "@/lib/levelUp";
import { addCoins } from "@/lib/addCoins";

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

    // Сначала отмечаем год (только если ещё не отмечен), потом начисляем —
    // два запуска крона подряд не дадут бонус дважды.
    const { data: marked, error: markError } = await admin
      .from("users")
      .update({ last_birthday_bonus_year: year })
      .eq("id", u.id)
      .or(`last_birthday_bonus_year.is.null,last_birthday_bonus_year.neq.${year}`)
      .select("id");
    if (markError || !marked?.length) {
      if (markError) console.error(`[birthday] mark failed for ${u.id}:`, markError);
      continue;
    }

    const { error: updateError } = await addCoins(admin, u.id, BIRTHDAY_BONUS_COINS);

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
