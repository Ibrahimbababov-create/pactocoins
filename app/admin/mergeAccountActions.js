"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { checkAndApplyLevelUp } from "@/lib/levelUp";
import { addCoins } from "@/lib/addCoins";
import { logRevenueChange } from "@/lib/revenueAudit";

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
  const admin_user = await requireAdmin();

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

  // Переносим баланс на новый аккаунт
  await addCoins(admin, newUserId, oldUser.balance);

  // Переносим всю историю и заявки на новый id — total_earned на обоих
  // аккаунтах пересчитывается сам, триггером на transactions, как только
  // меняется владелец строки.
  await admin
    .from("transactions")
    .update({ user_id: newUserId })
    .eq("user_id", oldUserId);

  await checkAndApplyLevelUp(newUserId, admin);

  await admin
    .from("revenue_requests")
    .update({ user_id: newUserId })
    .eq("user_id", oldUserId);

  await logRevenueChange(admin, {
    userId: newUserId,
    actorId: admin_user.id,
    source: "web",
    action: "other",
    note: "Объединение аккаунтов: оплаты перенесены со старого аккаунта на этот",
  });

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

  // Турниры: участие и матчи держат ссылку на человека (on delete restrict),
  // без переноса удаление старого аккаунта бы не прошло.
  await admin
    .from("tournament_entries")
    .update({ user_id: newUserId })
    .eq("user_id", oldUserId);
  for (const col of ["player_a", "player_b", "winner_id", "reported_by", "reported_winner", "disputed_by", "decided_by"]) {
    await admin
      .from("tournament_matches")
      .update({ [col]: newUserId })
      .eq(col, oldUserId);
  }
  await admin
    .from("tournaments")
    .update({ winner_id: newUserId })
    .eq("winner_id", oldUserId);

  // Удаляем старый аккаунт полностью (auth + public.users каскадом)
  await admin.auth.admin.deleteUser(oldUserId);

  revalidatePath("/admin");
  revalidatePath("/admin/employees");
  revalidatePath("/admin/merge-accounts");
  revalidatePath("/mop");
  revalidatePath("/mop/rating");

  return { success: true };
}
