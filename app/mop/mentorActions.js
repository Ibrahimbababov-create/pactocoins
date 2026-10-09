"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { notifyUser } from "@/lib/notifyUser";

// Просто «он наставник» — без привязки к конкретному стажёру. Нужно там,
// где наставник распоряжается ещё не своими: берёт под себя новичка.
async function requireMentor() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { data: me } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "mentor" && me?.role !== "admin") {
    throw new Error("Доступ запрещён");
  }
  return user;
}

// Наставник распоряжается только своими стажёрами — проверяем оба конца:
// что он действительно наставник и что этот стажёр закреплён за ним.
async function requireMentorOf(traineeId) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { data: me } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "mentor" && me?.role !== "admin") {
    throw new Error("Доступ запрещён");
  }

  if (me.role === "mentor") {
    const { data: trainee } = await supabase
      .from("users")
      .select("id, mentor_id")
      .eq("id", traineeId)
      .single();

    if (trainee?.mentor_id !== user.id) throw new Error("Это не твой стажёр");
  }

  return user;
}

export async function setTraineeProject(traineeId, projectId) {
  await requireMentorOf(traineeId);
  const admin = createAdminClient();

  const { error } = await admin
    .from("users")
    .update({ project_id: projectId || null })
    .eq("id", traineeId);

  if (error) return { error: error.message };

  revalidatePath("/mop/trainees");
  return { success: true };
}

// Взять новичка под себя. Можно брать и чужого: наставник один, а
// ошибиться при регистрации легко — пусть разруливает сам.
export async function takeTrainee(traineeId) {
  const user = await requireMentor();
  const admin = createAdminClient();

  const { error } = await admin
    .from("users")
    .update({ mentor_id: user.id })
    .eq("id", traineeId)
    .eq("is_active", true);

  if (error) return { error: error.message };

  revalidatePath("/mop/trainees");
  return { success: true };
}

// Снять с себя — человек остаётся в компании, просто без наставника.
export async function releaseTrainee(traineeId) {
  await requireMentorOf(traineeId);
  const admin = createAdminClient();

  const { error } = await admin
    .from("users")
    .update({ mentor_id: null })
    .eq("id", traineeId);

  if (error) return { error: error.message };

  revalidatePath("/mop/trainees");
  return { success: true };
}

// Не справился — наставник закрывает ему доступ сам, не дёргая Ибрагима.
// Увольнение мягкое: запись остаётся, просто человек больше не входит.
export async function dismissTrainee(traineeId, reason) {
  await requireMentorOf(traineeId);
  const admin = createAdminClient();

  const { error } = await admin
    .from("users")
    .update({ is_active: false })
    .eq("id", traineeId);

  if (error) return { error: error.message };

  const text = reason?.trim()
    ? `Доступ к PactoCoins закрыт.\n\n💬 ${reason.trim()}`
    : "Доступ к PactoCoins закрыт.";
  await notifyUser(admin, traineeId, text, "notify_requests");

  revalidatePath("/mop/trainees");
  return { success: true };
}
