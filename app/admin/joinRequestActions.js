"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import {
  approveJoinRequestInternal,
  rejectJoinRequestInternal,
} from "@/lib/telegramApprovals";

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

export async function approveJoinRequest(requestId) {
  await requireAdmin();
  const result = await approveJoinRequestInternal(requestId);

  revalidatePath("/admin/join-requests");
  revalidatePath("/admin/employees");
  return result;
}

export async function rejectJoinRequest(requestId) {
  await requireAdmin();
  const result = await rejectJoinRequestInternal(requestId);

  revalidatePath("/admin/join-requests");
  return result;
}
