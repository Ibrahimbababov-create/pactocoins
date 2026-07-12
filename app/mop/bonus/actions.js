"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";

export async function submitBonusRequest(category, comment) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const meta = BONUS_CATEGORIES[category];
  if (!meta) return { error: "Неизвестная категория" };

  const { error } = await supabase.from("bonus_requests").insert({
    user_id: user.id,
    category,
    amount_coins: meta.amount,
    comment,
    status: "pending",
  });

  if (error) return { error: "Не удалось отправить заявку" };

  revalidatePath("/mop");
  return { success: true };
}
