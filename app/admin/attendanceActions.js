"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getAttendanceConfig,
  saveAttendanceConfig,
  isClock,
  ATTENDANCE_OFF,
} from "@/lib/attendance";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

// Общее время: до скольки приход засчитывается сам.
export async function setAttendanceUntil(until) {
  if (!(await requireAdmin())) return { error: "Доступ запрещён" };
  if (!isClock(until)) return { error: "Время в виде 11:15" };
  const admin = createAdminClient();
  const config = await getAttendanceConfig(admin);
  const res = await saveAttendanceConfig(admin, { ...config, until });
  revalidatePath("/admin/attendance");
  return res;
}

// Своё время человека. value: "12:00", "off" (всё на решение) или ""
// (как у всех).
export async function setAttendancePerson(userId, value) {
  if (!(await requireAdmin())) return { error: "Доступ запрещён" };
  if (!userId) return { error: "Выбери человека" };
  if (value && value !== ATTENDANCE_OFF && !isClock(value)) return { error: "Время в виде 12:00" };
  const admin = createAdminClient();
  const config = await getAttendanceConfig(admin);
  const people = { ...config.people };
  if (value) people[userId] = value;
  else delete people[userId];
  const res = await saveAttendanceConfig(admin, { ...config, people });
  revalidatePath("/admin/attendance");
  return res;
}
