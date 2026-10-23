"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { saveSurveyOpen } from "@/lib/survey";

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
