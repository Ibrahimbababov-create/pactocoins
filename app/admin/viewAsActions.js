"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import {
  VIEW_AS_COOKIE,
  VIEW_USER_COOKIE,
  isViewableRole,
} from "@/lib/viewAs";
import { createAdminClient } from "@/lib/supabase-admin";
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
const COOKIE_OPTS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: 60 * 60 * 8,
};

export async function setViewAs(role) {
  await requireAdmin();
  if (!isViewableRole(role)) throw new Error("Нет такой роли");

  cookies().set(VIEW_AS_COOKIE, role, COOKIE_OPTS);
  cookies().delete(VIEW_USER_COOKIE);

  redirect(roleHome(role));
}

// Смотреть глазами конкретного человека: его команда, его стажёры.
// Роль берём его собственную, чтобы не угадывать.
export async function setViewAsUser(formData) {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  if (!userId) redirect("/admin");

  const admin = createAdminClient();
  const { data: person } = await admin
    .from("users")
    .select("id, role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (!person?.is_active) throw new Error("Человек не найден");
  if (!isViewableRole(person.role)) throw new Error("В эту роль не зайти");

  cookies().set(VIEW_AS_COOKIE, person.role, COOKIE_OPTS);
  cookies().set(VIEW_USER_COOKIE, person.id, COOKIE_OPTS);

  redirect(roleHome(person.role));
}

export async function clearViewAs() {
  await requireAdmin();
  cookies().delete(VIEW_AS_COOKIE);
  cookies().delete(VIEW_USER_COOKIE);
  redirect("/admin");
}
