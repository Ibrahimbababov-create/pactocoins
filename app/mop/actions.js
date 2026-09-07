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

const NOTIFY_PREFS = new Set([
  "notify_requests",
  "notify_shop",
  "notify_goal",
  "notify_rating",
]);

export async function updateNotificationPref(key, enabled) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };
  if (!NOTIFY_PREFS.has(key)) return { error: "Неизвестная настройка" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ [key]: !!enabled })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/mop/settings");
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

// ---------- Иерархия МОП ↔ РОП ----------

async function me() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");
  const { data: profile } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .single();
  return profile;
}

// МОП выбирает / меняет своего руководителя.
export async function setMyRop(ropId) {
  const p = await me();
  const admin = createAdminClient();

  let clean = null;
  if (ropId) {
    const { data: rop } = await admin
      .from("users")
      .select("id")
      .eq("id", ropId)
      .eq("role", "rop")
      .eq("is_active", true)
      .maybeSingle();
    if (!rop) return { error: "РОП не найден" };
    clean = rop.id;
  }

  const { error } = await admin
    .from("users")
    .update({ rop_id: clean })
    .eq("id", p.id);
  if (error) return { error: error.message };

  revalidatePath("/mop/settings");
  revalidatePath("/mop/team");
  return { success: true };
}

// РОП забирает МОПа себе в команду.
export async function assignMopToMe(mopId) {
  const p = await me();
  if (p.role !== "rop" && p.role !== "admin") return { error: "Нет прав" };
  const admin = createAdminClient();

  const { data: mop } = await admin
    .from("users")
    .select("id, role, rop_id")
    .eq("id", mopId)
    .eq("is_active", true)
    .maybeSingle();
  if (!mop || mop.role !== "mop") return { error: "Сотрудник не найден" };

  // РОП может забрать только свободного МОПа. Переназначать чужого —
  // только через админа.
  if (p.role === "rop" && mop.rop_id && mop.rop_id !== p.id) {
    return { error: "Этот МОП уже в команде другого РОПа" };
  }

  const { error } = await admin
    .from("users")
    .update({ rop_id: p.id })
    .eq("id", mopId);
  if (error) return { error: error.message };

  revalidatePath("/mop/team");
  return { success: true };
}

// РОП убирает МОПа из своей команды (только своего).
export async function unassignMop(mopId) {
  const p = await me();
  if (p.role !== "rop" && p.role !== "admin") return { error: "Нет прав" };
  const admin = createAdminClient();

  let q = admin.from("users").update({ rop_id: null }).eq("id", mopId);
  if (p.role === "rop") q = q.eq("rop_id", p.id);

  const { error } = await q;
  if (error) return { error: error.message };

  revalidatePath("/mop/team");
  return { success: true };
}
