"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";

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

  const { error } = await supabase.from("bonus_requests").insert({
    user_id: user.id,
    category,
    amount_coins: amount,
    comment,
    status: "pending",
  });

  if (error) return { error: "Не удалось отправить заявку" };

  revalidatePath("/mop");
  revalidatePath("/admin/bonus-requests");
  return { success: true };
}
