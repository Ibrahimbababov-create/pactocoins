"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
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

// ---------- Сотрудники ----------

export async function createMop(formData) {
  await requireAdmin();
  const admin = createAdminClient();

  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");
  const role = formData.get("role") || "mop";

  const { data: authUser, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError) return { error: authError.message };

  const { error: insertError } = await admin.from("users").insert({
    id: authUser.user.id,
    name,
    email,
    role,
    balance: 0,
    total_earned: 0,
    month_earned: 0,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath("/admin/employees");
  return { success: true };
}

export async function updateMop(userId, formData) {
  await requireAdmin();
  const admin = createAdminClient();

  const name = formData.get("name");
  const role = formData.get("role");

  const { error } = await admin
    .from("users")
    .update({ name, role })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin/employees");
  return { success: true };
}

export async function manualAdjustBalance(userId, amount, description) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("users")
    .select("balance, total_earned, month_earned")
    .eq("id", userId)
    .single();

  const newBalance = profile.balance + amount;
  if (newBalance < 0) return { error: "Баланс не может уйти в минус" };

  const update = { balance: newBalance };
  if (amount > 0) {
    update.total_earned = profile.total_earned + amount;
    update.month_earned = profile.month_earned + amount;
  }

  const { error: updateError } = await admin
    .from("users")
    .update(update)
    .eq("id", userId);

  if (updateError) return { error: updateError.message };

  await admin.from("transactions").insert({
    user_id: userId,
    type: amount >= 0 ? "manual_add" : "manual_subtract",
    amount_coins: amount,
    description: description || "Ручная корректировка",
  });

  revalidatePath("/admin/employees");
  revalidatePath("/admin");
  return { success: true };
}

// ---------- Заявки на выручку ----------

export async function approveRevenueRequest(requestId) {
  const admin_user = await requireAdmin();
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("revenue_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "pending") {
    return { error: "Заявка уже обработана" };
  }

  const { data: profile } = await admin
    .from("users")
    .select("balance, total_earned, month_earned")
    .eq("id", request.user_id)
    .single();

  const coins = request.calculated_coins;

  const { error: updateUserError } = await admin
    .from("users")
    .update({
      balance: profile.balance + coins,
      total_earned: profile.total_earned + coins,
      month_earned: profile.month_earned + coins,
    })
    .eq("id", request.user_id);

  if (updateUserError) return { error: updateUserError.message };

  await admin
    .from("revenue_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin_user.id,
    })
    .eq("id", requestId);

  await admin.from("transactions").insert({
    user_id: request.user_id,
    type: "earn",
    amount_coins: coins,
    description: `Выручка подтверждена: ${request.amount_kzt.toLocaleString(
      "ru-RU"
    )} ₸`,
    created_by: admin_user.id,
  });

  revalidatePath("/admin/revenue-requests");
  revalidatePath("/admin");
  return { success: true };
}

export async function rejectRevenueRequest(requestId) {
  const admin_user = await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("revenue_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin_user.id,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  revalidatePath("/admin/revenue-requests");
  return { success: true };
}

// ---------- Заявки на покупки ----------

export async function updatePurchaseStatus(purchaseId, newStatus) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: purchase } = await admin
    .from("purchase_requests")
    .select("*")
    .eq("id", purchaseId)
    .single();

  if (!purchase) return { error: "Заявка не найдена" };

  // Если отклоняем (и раньше не было отклонено) — возвращаем коины
  if (newStatus === "rejected" && purchase.status !== "rejected") {
    const { data: profile } = await admin
      .from("users")
      .select("balance")
      .eq("id", purchase.user_id)
      .single();

    await admin
      .from("users")
      .update({ balance: profile.balance + purchase.price_coins })
      .eq("id", purchase.user_id);

    await admin.from("transactions").insert({
      user_id: purchase.user_id,
      type: "manual_add",
      amount_coins: purchase.price_coins,
      description: "Возврат за отклонённую покупку",
    });
  }

  const { error } = await admin
    .from("purchase_requests")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", purchaseId);

  if (error) return { error: error.message };

  revalidatePath("/admin/purchase-requests");
  return { success: true };
}

// ---------- Магазин наград ----------

export async function createReward(formData) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin.from("rewards").insert({
    title: formData.get("title"),
    category: formData.get("category"),
    price_coins: Number(formData.get("price_coins")),
    description: formData.get("description"),
    sort_order: Number(formData.get("sort_order")) || 0,
    highlight_color: formData.get("highlight_color") || null,
    is_active: true,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/rewards");
  revalidatePath("/mop/shop");
  return { success: true };
}

export async function toggleRewardActive(rewardId, isActive) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("rewards")
    .update({ is_active: isActive })
    .eq("id", rewardId);

  if (error) return { error: error.message };

  revalidatePath("/admin/rewards");
  revalidatePath("/mop/shop");
  return { success: true };
}

export async function updateReward(rewardId, formData) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("rewards")
    .update({
      title: formData.get("title"),
      category: formData.get("category"),
      price_coins: Number(formData.get("price_coins")),
      description: formData.get("description"),
      sort_order: Number(formData.get("sort_order")) || 0,
      highlight_color: formData.get("highlight_color") || null,
    })
    .eq("id", rewardId);

  if (error) return { error: error.message };

  revalidatePath("/admin/rewards");
  revalidatePath("/mop/shop");
  return { success: true };
}

// ---------- Заявки на бонусы (приход вовремя, план и т.д.) ----------

export async function approveBonusRequest(requestId) {
  const admin_user = await requireAdmin();
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("bonus_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request || request.status !== "pending") {
    return { error: "Заявка уже обработана" };
  }

  const { data: profile } = await admin
    .from("users")
    .select("balance, total_earned, month_earned")
    .eq("id", request.user_id)
    .single();

  const coins = request.amount_coins;

  await admin
    .from("users")
    .update({
      balance: profile.balance + coins,
      total_earned: profile.total_earned + coins,
      month_earned: profile.month_earned + coins,
    })
    .eq("id", request.user_id);

  await admin
    .from("bonus_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin_user.id,
    })
    .eq("id", requestId);

  await admin.from("transactions").insert({
    user_id: request.user_id,
    type: "earn",
    amount_coins: coins,
    description: `Бонус: ${request.category}`,
    created_by: admin_user.id,
  });

  revalidatePath("/admin/bonus-requests");
  revalidatePath("/admin");
  return { success: true };
}

export async function rejectBonusRequest(requestId) {
  const admin_user = await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("bonus_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin_user.id,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  revalidatePath("/admin/bonus-requests");
  return { success: true };
}

// ---------- Автоначисление ТОП-1/2/3 (неделя / месяц) ----------

export async function awardTopPerformers(period) {
  await requireAdmin();
  const admin = createAdminClient();

  const now = new Date();
  let startDate;
  if (period === "week") {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const { data: transactions } = await admin
    .from("transactions")
    .select("user_id, amount_coins")
    .eq("type", "earn")
    .gte("created_at", startDate.toISOString());

  const totals = {};
  transactions?.forEach((t) => {
    totals[t.user_id] = (totals[t.user_id] || 0) + t.amount_coins;
  });

  const ranked = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (ranked.length === 0) {
    return { error: "Нет данных за этот период" };
  }

  const prizes = period === "week" ? [2000, 1000, 300] : [10000, 5000, 2000];
  const labels =
    period === "week"
      ? ["ТОП-1 недели", "ТОП-2 недели", "ТОП-3 недели"]
      : ["ТОП-1 месяца", "ТОП-2 месяца", "ТОП-3 месяца"];

  for (let i = 0; i < ranked.length; i++) {
    const [userId] = ranked[i];
    const prize = prizes[i];

    const { data: profile } = await admin
      .from("users")
      .select("balance, total_earned, month_earned")
      .eq("id", userId)
      .single();

    await admin
      .from("users")
      .update({
        balance: profile.balance + prize,
        total_earned: profile.total_earned + prize,
        month_earned: profile.month_earned + prize,
      })
      .eq("id", userId);

    await admin.from("transactions").insert({
      user_id: userId,
      type: "manual_add",
      amount_coins: prize,
      description: labels[i],
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/bonus-requests");
  return { success: true, winners: ranked.length };
}

// ---------- Массовое начисление нескольким сотрудникам одинаковой суммы ----------

export async function manualAdjustBalanceBulk(userIds, amount, description) {
  await requireAdmin();
  const admin = createAdminClient();

  let successCount = 0;

  for (const userId of userIds) {
    const { data: profile } = await admin
      .from("users")
      .select("balance, total_earned, month_earned")
      .eq("id", userId)
      .single();

    if (!profile) continue;

    const newBalance = profile.balance + amount;
    if (newBalance < 0) continue;

    const update = { balance: newBalance };
    if (amount > 0) {
      update.total_earned = profile.total_earned + amount;
      update.month_earned = profile.month_earned + amount;
    }

    await admin.from("users").update(update).eq("id", userId);

    await admin.from("transactions").insert({
      user_id: userId,
      type: amount >= 0 ? "manual_add" : "manual_subtract",
      amount_coins: amount,
      description: description || "Массовое начисление",
    });

    successCount++;
  }

  revalidatePath("/admin/employees");
  revalidatePath("/admin/bonus-requests");
  revalidatePath("/admin");
  return { success: true, count: successCount };
}

// ---------- Полный сброс тестовых данных ----------

export async function resetAllStats() {
  await requireAdmin();
  const admin = createAdminClient();

  await admin.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("revenue_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("bonus_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("purchase_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  await admin
    .from("users")
    .update({ balance: 0, total_earned: 0, month_earned: 0 })
    .eq("role", "mop");

  revalidatePath("/admin");
  revalidatePath("/admin/employees");
  revalidatePath("/admin/revenue-requests");
  revalidatePath("/admin/bonus-requests");
  revalidatePath("/admin/purchase-requests");
  revalidatePath("/mop");
  revalidatePath("/mop/rating");

  return { success: true };
}

// ---------- Сброс данных одного сотрудника ----------

export async function resetUserStats(userId) {
  await requireAdmin();
  const admin = createAdminClient();

  await admin.from("transactions").delete().eq("user_id", userId);
  await admin.from("revenue_requests").delete().eq("user_id", userId);
  await admin.from("bonus_requests").delete().eq("user_id", userId);
  await admin.from("purchase_requests").delete().eq("user_id", userId);

  await admin
    .from("users")
    .update({ balance: 0, total_earned: 0, month_earned: 0 })
    .eq("id", userId);

  revalidatePath("/admin");
  revalidatePath("/admin/employees");
  revalidatePath("/admin/revenue-requests");
  revalidatePath("/admin/bonus-requests");
  revalidatePath("/admin/purchase-requests");
  revalidatePath("/mop");
  revalidatePath("/mop/rating");

  return { success: true };
}

// ---------- Категории наград ----------

export async function createCategory(name) {
  await requireAdmin();
  const admin = createAdminClient();

  const trimmed = (name || "").trim();
  if (!trimmed) return { error: "Введи название категории" };

  const { data: existing } = await admin
    .from("reward_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = existing ? existing.sort_order + 1 : 0;

  const { error } = await admin
    .from("reward_categories")
    .insert({ name: trimmed, sort_order: nextOrder });

  if (error) return { error: "Такая категория уже есть" };

  revalidatePath("/admin/rewards");
  revalidatePath("/mop/shop");
  return { success: true };
}

export async function moveCategory(categoryId, direction) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: categories } = await admin
    .from("reward_categories")
    .select("*")
    .order("sort_order");

  const index = categories.findIndex((c) => c.id === categoryId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;

  if (index === -1 || swapIndex < 0 || swapIndex >= categories.length) {
    return { error: "Некуда двигать" };
  }

  const current = categories[index];
  const swapWith = categories[swapIndex];

  await admin
    .from("reward_categories")
    .update({ sort_order: swapWith.sort_order })
    .eq("id", current.id);

  await admin
    .from("reward_categories")
    .update({ sort_order: current.sort_order })
    .eq("id", swapWith.id);

  revalidatePath("/admin/rewards");
  revalidatePath("/mop/shop");
  return { success: true };
}

export async function deleteCategory(categoryId) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("reward_categories")
    .delete()
    .eq("id", categoryId);

  if (error) return { error: error.message };

  revalidatePath("/admin/rewards");
  revalidatePath("/mop/shop");
  return { success: true };
}
