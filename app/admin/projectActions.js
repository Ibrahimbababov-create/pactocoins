"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Доступ запрещён");
  return user;
}

export async function createProject(name) {
  await requireAdmin();
  const clean = String(name ?? "").trim();
  if (!clean) return { error: "Напиши название проекта" };

  const admin = createAdminClient();
  const { error } = await admin.from("projects").insert({ name: clean });
  if (error) return { error: error.message };

  revalidatePath("/admin/projects");
  return { success: true };
}

export async function renameProject(projectId, name) {
  await requireAdmin();
  const clean = String(name ?? "").trim();
  if (!clean) return { error: "Название не может быть пустым" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("projects")
    .update({ name: clean })
    .eq("id", projectId);
  if (error) return { error: error.message };

  revalidatePath("/admin/projects");
  return { success: true };
}

// Проект не удаляем, а закрываем: люди и их выручка остаются привязанными
// к истории, иначе прошлое рассыпется.
export async function setProjectActive(projectId, isActive) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("projects")
    .update({ is_active: isActive })
    .eq("id", projectId);
  if (error) return { error: error.message };

  revalidatePath("/admin/projects");
  return { success: true };
}

// У РОПа проектов может быть несколько, у проекта — несколько РОПов.
export async function setProjectRops(projectId, ropIds) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error: delError } = await admin
    .from("project_rops")
    .delete()
    .eq("project_id", projectId);
  if (delError) return { error: delError.message };

  const rows = (ropIds ?? []).map((ropId) => ({
    project_id: projectId,
    rop_id: ropId,
  }));

  if (rows.length > 0) {
    const { error } = await admin.from("project_rops").insert(rows);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/projects");
  revalidatePath("/admin/employees");
  return { success: true };
}
