"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { notifyUser, escapeHtml } from "@/lib/notifyUser";

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

export async function approveRewardSuggestion(suggestionId, comment) {
  const admin_user = await requireAdmin();
  const admin = createAdminClient();

  const { data: suggestion } = await admin
    .from("reward_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .single();

  if (!suggestion || suggestion.status !== "pending") {
    return { error: "Заявка уже обработана" };
  }

  const { data: reward, error: rewardError } = await admin
    .from("rewards")
    .insert({
      title: suggestion.title,
      category: "Предложено сотрудниками",
      price_coins: suggestion.price_coins,
      is_variable: false,
      description: suggestion.description,
      image_url: suggestion.image_url,
      is_active: true,
    })
    .select("id")
    .single();

  if (rewardError) return { error: rewardError.message };

  await admin
    .from("reward_suggestions")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin_user.id,
      reward_id: reward.id,
      admin_comment: comment?.trim() || null,
    })
    .eq("id", suggestionId);

  let text = `✅ Твоё предложение «${escapeHtml(suggestion.title)}» добавлено в магазин!`;
  if (comment?.trim()) text += `\n\n💬 ${escapeHtml(comment.trim())}`;
  await notifyUser(admin, suggestion.user_id, text, "notify_requests");

  revalidatePath("/admin/reward-suggestions");
  revalidatePath("/mop/shop");
  revalidatePath("/observer/shop");
  return { success: true };
}

export async function rejectRewardSuggestion(suggestionId, comment) {
  const admin_user = await requireAdmin();
  const admin = createAdminClient();

  const { data: suggestion } = await admin
    .from("reward_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .single();

  if (!suggestion || suggestion.status !== "pending") {
    return { error: "Заявка уже обработана" };
  }

  const { error } = await admin
    .from("reward_suggestions")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin_user.id,
      admin_comment: comment?.trim() || null,
    })
    .eq("id", suggestionId);

  if (error) return { error: error.message };

  let text = `❌ Предложение «${escapeHtml(suggestion.title)}» отклонено`;
  if (comment?.trim()) text += `\n\n💬 ${escapeHtml(comment.trim())}`;
  await notifyUser(admin, suggestion.user_id, text, "notify_requests");

  revalidatePath("/admin/reward-suggestions");
  return { success: true };
}
