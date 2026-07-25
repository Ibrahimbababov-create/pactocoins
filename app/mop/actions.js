"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { nowInAlmaty } from "@/lib/timezone";

export async function setMyBirthday(formData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const { data: profile } = await supabase
    .from("users")
    .select("birthday")
    .eq("id", user.id)
    .single();

  if (profile?.birthday) {
    return { error: "Дата рождения уже указана" };
  }

  const birthday = formData.get("birthday");
  if (!birthday) return { error: "Укажи дату" };

  const alreadyGifted = formData.get("already_gifted") === "on";

  const admin = createAdminClient();
  const update = { birthday };
  if (alreadyGifted) {
    update.last_birthday_bonus_year = nowInAlmaty().year;
  }

  const { error } = await admin
    .from("users")
    .update(update)
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/mop");
  return { success: true };
}
