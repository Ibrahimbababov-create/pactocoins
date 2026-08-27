"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { nowInAlmaty } from "@/lib/timezone";
import { getLevelForAmount } from "@/lib/levels";

export async function updateMyName(formData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const name = (formData.get("name")?.toString() || "").trim();
  if (!name) return { error: "Укажи имя" };
  if (name.length > 50) return { error: "Слишком длинное имя" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ name })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/mop");
  return { success: true };
}

export async function updateReminderSettings(formData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const enabled = formData.get("enabled") === "on";
  const time = formData.get("time")?.toString() || null;

  if (enabled && !time) return { error: "Укажи время" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({
      reminder_enabled: enabled,
      reminder_time: enabled ? time : null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/mop/settings");
  return { success: true };
}

// Пользователь досмотрел полноэкранную анимацию нового ранга —
// запоминаем, чтобы не показывать её снова. Ранг считаем заново из
// total_earned, значение с клиента не принимаем.
export async function markLevelCelebrated() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const { data: profile } = await supabase
    .from("users")
    .select("total_earned")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Профиль не найден" };

  const level = getLevelForAmount(profile.total_earned);

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ celebrated_level_id: level.id })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/mop");
  return { success: true };
}

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
