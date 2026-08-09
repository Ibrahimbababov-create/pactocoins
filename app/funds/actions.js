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

export async function createFund(title, description, goalCoins) {
  const admin_user = await requireAdmin();
  const admin = createAdminClient();

  if (!title || !title.trim()) return { error: "Укажи название" };

  const goal = Number(goalCoins);
  if (!goal || goal <= 0) return { error: "Укажи цель больше нуля" };

  const { error } = await admin.from("funds").insert({
    title: title.trim(),
    description: description?.trim() || null,
    goal_coins: goal,
    created_by: admin_user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/funds");
  revalidatePath("/admin/funds");
  return { success: true };
}

export async function closeFund(fundId) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: fund } = await admin
    .from("funds")
    .select("*")
    .eq("id", fundId)
    .single();

  if (!fund) return { error: "Копилка не найдена" };

  const { data: contributions } = await admin
    .from("fund_contributions")
    .select("amount_coins")
    .eq("fund_id", fundId);

  const total = (contributions ?? []).reduce(
    (sum, c) => sum + c.amount_coins,
    0
  );
  const newStatus = total >= fund.goal_coins ? "completed" : "closed";

  const { error } = await admin
    .from("funds")
    .update({ status: newStatus })
    .eq("id", fundId);

  if (error) return { error: error.message };

  revalidatePath("/funds");
  revalidatePath("/admin/funds");
  return { success: true };
}

export async function contributeToFund(fundId, amount) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const coins = Number(amount);
  if (!coins || coins <= 0) return { error: "Укажи сумму больше нуля" };

  const admin = createAdminClient();

  const { data: fund } = await admin
    .from("funds")
    .select("*")
    .eq("id", fundId)
    .single();

  if (!fund || fund.status !== "active") {
    return { error: "Копилка недоступна" };
  }

  const { data: profile } = await admin
    .from("users")
    .select("balance")
    .eq("id", user.id)
    .single();

  if (!profile || profile.balance < coins) {
    return { error: "Недостаточно coins" };
  }

  const { error: balanceError } = await admin
    .from("users")
    .update({ balance: profile.balance - coins })
    .eq("id", user.id);

  if (balanceError) return { error: balanceError.message };

  await admin.from("transactions").insert({
    user_id: user.id,
    type: "spend",
    amount_coins: -coins,
    description: `Взнос в копилку: ${fund.title}`,
    created_by: user.id,
  });

  const { error: contribError } = await admin
    .from("fund_contributions")
    .insert({
      fund_id: fundId,
      user_id: user.id,
      amount_coins: coins,
    });

  if (contribError) return { error: contribError.message };

  revalidatePath("/funds");
  revalidatePath("/mop");
  return { success: true };
}
