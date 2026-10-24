"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { isTheme } from "@/lib/themes";

// Тема — личная настройка: меняет её человек себе, а не всей компании.
// RLS на users разрешает update только админу, поэтому пишем через
// security-definer функцию set_my_theme (см. supabase/schema.sql) —
// она меняет только свою тему и только у вызывающего, ничего больше.
export async function setMyTheme(theme) {
  if (!isTheme(theme)) return { error: "Неизвестная тема" };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const { error } = await supabase.rpc("set_my_theme", { p_theme: theme });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
