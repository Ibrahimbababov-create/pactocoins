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

export async function mergeAccounts(oldUserId, newUserId) {
  await requireAdmin();

  if (!oldUserId || !newUserId) {
    return { error: "Выбери оба аккаунта" };
  }
  if (oldUserId === newUserId) {
    return { error: "Это один и тот же аккаунт" };
  }

  const admin = createAdminClient();

  const { data: oldUser } = await admin
    .from("users")
    .select("*")
    .eq("id", oldUserId)
    .single();

  const { data: newUser } = await admin
    .from("users")
    .select("*")
    .eq("id", newUserId)
    .single();

  if (!oldUser || !newUser) {
    return { error: "Аккаунт не найден" };
  }

  // Переносим баланс и статистику на новый аккаунт
  await admin
    .from("users")
    .update({
      balance: newUser.balance + oldUser.balance,
      total_earned: newUser.total_earned + oldUser.total_earned,
      month_earned: newUser.month_earned + oldUser.month_earned,
    })
    .eq("id", newUserId);

  // Переносим всю историю и заявки на новый id
  await admin
    .from("transactions")
    .update({ user_id: newUserId })
    .eq("user_id", oldUserId);

  await admin
    .from("revenue_requests")
    .update({ user_id: newUserId })
    .eq("user_id", oldUserId);

  await admin
    .from("bonus_requests")
    .update({ user_id: newUserId })
    .eq("user_id", oldUserId);

  await admin
    .from("purchase_requests")
    .update({ user_id: newUserId })
    .eq("user_id", oldUserId);

  await admin
    .from("messages")
    .update({ sender_id: newUserId })
    .eq("sender_id", oldUserId);

  await admin
    .from("messages")
    .update({ recipient_id: newUserId })
    .eq("recipient_id", oldUserId);

  await admin
    .from("anonymous_messages")
    .update({ sender_id: newUserId })
    .eq("sender_id", oldUserId);

  // Удаляем старый аккаунт полностью (auth + public.users каскадом)
  await admin.auth.admin.deleteUser(oldUserId);

  revalidatePath("/admin");
  revalidatePath("/admin/employees");
  revalidatePath("/admin/merge-accounts");
  revalidatePath("/mop");
  revalidatePath("/mop/rating");

  return { success: true };
}
