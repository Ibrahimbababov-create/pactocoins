"use server";

import { formatCoins } from "@/lib/plural";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";
import { attendanceToday, sendBonusForReview } from "@/lib/attendance";

const MAX_CUSTOM_AMOUNT = 20000;

export async function submitBonusRequest(category, comment, customAmount) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const meta = BONUS_CATEGORIES[category];
  if (!meta || meta.hidden) return { error: "Такой бонус сейчас не начисляется" };

  let amount = meta.amount;

  if (amount === null) {
    const parsed = Number(customAmount);
    if (!parsed || parsed <= 0) {
      return { error: "Укажи количество коинов" };
    }
    if (parsed > MAX_CUSTOM_AMOUNT) {
      return { error: `Максимум ${formatCoins(MAX_CUSTOM_AMOUNT)} за раз` };
    }
    amount = Math.floor(parsed);

    if (!comment || comment.trim().length < 3) {
      return { error: "Опиши, что именно сделал" };
    }
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, is_guest")
    .eq("id", user.id)
    .single();

  if (profile?.is_guest) {
    return { error: "В гостевом режиме бонусы не запрашиваются" };
  }

  // Приход — один раз в день. Обычно его засчитывает сам бот по кружку
  // в теме «Приступил вовремя к работе», заявка отсюда нужна, только если
  // кружок опоздал, а у человека сегодня другой график.
  if (category === "attendance") {
    const today = await attendanceToday(createAdminClient(), user.id);
    if (today.some((r) => r.status === "approved")) {
      return { error: "Сегодня приход уже засчитан" };
    }
    if (today.length) {
      return { error: "Приход за сегодня уже ждёт решения" };
    }
  }

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

  await sendBonusForReview(createAdminClient(), inserted, profile?.name);

  revalidatePath("/mop");
  revalidatePath("/admin/bonus-requests");
  return { success: true };
}
