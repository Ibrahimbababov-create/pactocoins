"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

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
