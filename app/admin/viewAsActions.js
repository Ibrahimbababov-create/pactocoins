"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { VIEW_AS_COOKIE, isViewableRole } from "@/lib/viewAs";
import { roleHome } from "@/lib/roles";

async function requireAdmin() {
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

  if (me?.role !== "admin") throw new Error("Доступ запрещён");
}

// Админ смотрит кабинет глазами роли. Храним выбор в куке, а не в адресе:
// раньше это был ?as=trainee, и просмотр слетал на первом же переходе по
// меню. Кука живёт восемь часов — рабочий день.
export async function setViewAs(role) {
  await requireAdmin();
  if (!isViewableRole(role)) throw new Error("Нет такой роли");

  cookies().set(VIEW_AS_COOKIE, role, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
  });

  redirect(roleHome(role));
}

export async function clearViewAs() {
  await requireAdmin();
  cookies().delete(VIEW_AS_COOKIE);
  redirect("/admin");
}
