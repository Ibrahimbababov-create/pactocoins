"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { markTelegramRequestHandled, userNameById } from "@/lib/telegramMessageSync";
import {
  approveJoinRequestInternal,
  rejectJoinRequestInternal,
} from "@/lib/telegramApprovals";

// Принимать новичков может админ и наставник: наставник ведёт их с
// первого дня, логично чтобы он же их и заводил.
async function requireAdminOrMentor() {
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

  if (profile?.role !== "admin" && profile?.role !== "mentor") {
    throw new Error("Доступ запрещён");
  }

  return user;
}

async function syncJoinMessage(userId, requestId, status, result) {
  if (result?.error) return;
  const admin = createAdminClient();
  await markTelegramRequestHandled(admin, {
    table: "join_requests",
    id: requestId,
    status,
    byName: await userNameById(admin, userId),
  });
}

export async function approveJoinRequest(requestId, comment) {
  const user = await requireAdminOrMentor();
  const result = await approveJoinRequestInternal(requestId, comment);

  await syncJoinMessage(user.id, requestId, "approved", result);

  revalidatePath("/admin/join-requests");
  revalidatePath("/admin/employees");
  return result;
}

export async function rejectJoinRequest(requestId, comment) {
  const user = await requireAdminOrMentor();
  const result = await rejectJoinRequestInternal(requestId, comment);

  await syncJoinMessage(user.id, requestId, "rejected", result);

  revalidatePath("/admin/join-requests");
  return result;
}
