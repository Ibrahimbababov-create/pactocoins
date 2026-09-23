"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { isTheme } from "@/lib/themes";

// Тема — личная настройка: меняет её человек себе, а не всей компании.
// Пока переключатель стоит только в админке; позже он же появится у
// сотрудников, когда темы начнут открываться за уровни.
export async function setMyTheme(theme) {
  if (!isTheme(theme)) return { error: "Неизвестная тема" };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const { error } = await supabase
    .from("users")
    .update({ theme })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
