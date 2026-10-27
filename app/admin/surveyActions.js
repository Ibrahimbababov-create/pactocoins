"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { saveSurveyEnabled, saveSurveyOpen, saveSurveyEndsAt } from "@/lib/survey";

// Открыть или закрыть опрос для команды.
export async function toggleSurvey(open) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: "Доступ запрещён" };
  const res = await saveSurveyOpen(createAdminClient(), Boolean(open));
  revalidatePath("/admin/survey");
  revalidatePath("/mop/more");
  revalidatePath("/mop/survey");
  return res;
}

// Последний день опроса. Пустая строка = без срока.
export async function setSurveyEndsAt(day) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: "Доступ запрещён" };
  const value = String(day ?? "").trim();
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: "Некорректная дата" };
  const res = await saveSurveyEndsAt(createAdminClient(), value);
  revalidatePath("/admin/survey");
  revalidatePath("/mop");
  revalidatePath("/mop/more");
  revalidatePath("/mop/survey");
  return res;
}

// Включить опрос для сотрудников снова (или выключить совсем).
export async function setSurveyEnabled(enabled) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: "Доступ запрещён" };
  const res = await saveSurveyEnabled(createAdminClient(), Boolean(enabled));
  revalidatePath("/admin/survey");
  revalidatePath("/mop");
  revalidatePath("/mop/more");
  revalidatePath("/mop/survey");
  return res;
}
