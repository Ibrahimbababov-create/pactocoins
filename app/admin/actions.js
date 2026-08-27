"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { checkAndApplyLevelUp } from "@/lib/levelUp";
import { almatyDatetimeToUtcIso } from "@/lib/timezone";
import { calculateRevenueCoins } from "@/lib/coinRate";
import { uploadPhoto } from "@/lib/uploadPhoto";
import { notifyUser } from "@/lib/notifyUser";

function parseSale(formData) {
  const salePrice = Number(formData.get("sale_price_coins"));
  const saleEndsLocal = formData.get("sale_ends_at")?.toString();

  if (!salePrice && !saleEndsLocal) return { sale_price_coins: null, sale_ends_at: null };
  if (!salePrice || salePrice <= 0 || !saleEndsLocal) {
    return { error: "Для скидки укажи и цену со скидкой, и до какого момента" };
  }

  return {
    sale_price_coins: salePrice,
    sale_ends_at: almatyDatetimeToUtcIso(saleEndsLocal),
  };
}

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
  const birthday = formData.get("birthday") || null;
  const multiplierRaw = formData.get("coin_rate_multiplier");
  const multiplier = multiplierRaw ? Number(multiplierRaw) : 1;

  if (!multiplier || multiplier <= 0) {
    return { error: "Множитель коинов должен быть больше нуля" };
  }

  const { error } = await admin
    .from("users")
    .update({ name, role, birthday, coin_rate_multiplier: multiplier })
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

  if (amount > 0) {
    await checkAndApplyLevelUp(userId, admin);
  }

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

export async function approveRevenueRequest(requestId, earnedAtDate) {
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
    .select("balance, total_earned, month_earned, coin_rate_multiplier")
    .eq("id", request.user_id)
    .single();

  // Пересчитываем на моменте одобрения (не берём calculated_coins
  // как есть) — так множитель тимлида всегда актуальный, даже если
  // его поменяли уже после того, как заявка была подана.
  const coins = calculateRevenueCoins(
    request.amount_kzt,
    profile.coin_rate_multiplier
  );

  const { error: updateUserError } = await admin
    .from("users")
    .update({
      balance: profile.balance + coins,
      total_earned: profile.total_earned + coins,
      month_earned: profile.month_earned + coins,
    })
    .eq("id", request.user_id);

  if (updateUserError) return { error: updateUserError.message };

  await checkAndApplyLevelUp(request.user_id, admin);

  await admin
    .from("revenue_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin_user.id,
    })
    .eq("id", requestId);

  const transactionPayload = {
    user_id: request.user_id,
    type: "earn",
    amount_coins: coins,
    description: `Выручка подтверждена: ${request.amount_kzt.toLocaleString(
      "ru-RU"
    )} ₸`,
    created_by: admin_user.id,
  };

  // Если админ вручную указал дату оплаты (например, деньги пришли
  // в выходные, а подтверждают только в понедельник) — датируем
  // транзакцию этим днём, чтобы она попала в правильную неделю/месяц
  // в рейтинге, а не в текущую.
  if (earnedAtDate) {
    const parsed = new Date(`${earnedAtDate}T12:00:00`);
    if (!isNaN(parsed)) {
      transactionPayload.created_at = parsed.toISOString();
    }
  }

  await admin.from("transactions").insert(transactionPayload);

  await notifyUser(
    admin,
    request.user_id,
    `✅ Выручка ${request.amount_kzt.toLocaleString("ru-RU")} ₸ подтверждена — +${coins} coins`
  );

  revalidatePath("/admin/revenue-requests");
  revalidatePath("/admin");
  revalidatePath("/mop/rating");
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
      rating_exempt: true,
    });
  }

  const update = { status: newStatus, updated_at: new Date().toISOString() };
  // Отклонённая покупка не состоялась — реальных денег на неё не ушло.
  if (newStatus === "rejected") update.actual_kzt_amount = null;

  const { error } = await admin
    .from("purchase_requests")
    .update(update)
    .eq("id", purchaseId);

  if (error) return { error: error.message };

  if (newStatus === "approved" && purchase.status === "pending") {
    const { data: reward } = await admin
      .from("rewards")
      .select("title")
      .eq("id", purchase.reward_id)
      .single();
    await notifyUser(
      admin,
      purchase.user_id,
      `✅ Покупка «${reward?.title ?? "награда"}» одобрена`
    );
  }

  revalidatePath("/admin/purchase-requests");
  revalidatePath("/admin/budget");
  revalidatePath("/admin");
  return { success: true };
}

// ---------- Магазин наград ----------

export async function createReward(formData) {
  await requireAdmin();
  const admin = createAdminClient();

  const isVariable = formData.get("is_variable") === "on";
  const rateCoins = Number(formData.get("rate_coins"));
  const rateKzt = Number(formData.get("rate_kzt"));
  const priceCoins = Number(formData.get("price_coins"));

  if (isVariable && (!rateCoins || rateCoins <= 0 || !rateKzt || rateKzt <= 0)) {
    return { error: "Укажи курс: сколько coins за сколько тенге" };
  }
  if (!isVariable && (!priceCoins || priceCoins <= 0)) {
    return { error: "Укажи цену в coins" };
  }

  const sale = parseSale(formData);
  if (sale.error) return { error: sale.error };

  const { url: imageUrl, error: photoError } = await uploadPhoto(
    admin,
    "reward-photos",
    formData.get("photo")
  );
  if (photoError) return { error: photoError };

  const { error } = await admin.from("rewards").insert({
    title: formData.get("title"),
    category: formData.get("category"),
    price_coins: isVariable ? null : priceCoins,
    is_variable: isVariable,
    rate_coins: isVariable ? rateCoins : null,
    rate_kzt: isVariable ? rateKzt : null,
    sale_price_coins: sale.sale_price_coins,
    sale_ends_at: sale.sale_ends_at,
    description: formData.get("description"),
    sort_order: Number(formData.get("sort_order")) || 0,
    highlight_color: formData.get("highlight_color") || null,
    image_url: imageUrl,
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

  const isVariable = formData.get("is_variable") === "on";
  const rateCoins = Number(formData.get("rate_coins"));
  const rateKzt = Number(formData.get("rate_kzt"));
  const priceCoins = Number(formData.get("price_coins"));

  if (isVariable && (!rateCoins || rateCoins <= 0 || !rateKzt || rateKzt <= 0)) {
    return { error: "Укажи курс: сколько coins за сколько тенге" };
  }
  if (!isVariable && (!priceCoins || priceCoins <= 0)) {
    return { error: "Укажи цену в coins" };
  }

  const sale = parseSale(formData);
  if (sale.error) return { error: sale.error };

  const { url: imageUrl, error: photoError } = await uploadPhoto(
    admin,
    "reward-photos",
    formData.get("photo")
  );
  if (photoError) return { error: photoError };

  const update = {
    title: formData.get("title"),
    category: formData.get("category"),
    price_coins: isVariable ? null : priceCoins,
    is_variable: isVariable,
    rate_coins: isVariable ? rateCoins : null,
    rate_kzt: isVariable ? rateKzt : null,
    sale_price_coins: sale.sale_price_coins,
    sale_ends_at: sale.sale_ends_at,
    description: formData.get("description"),
    sort_order: Number(formData.get("sort_order")) || 0,
    highlight_color: formData.get("highlight_color") || null,
  };
  // Новое фото загрузили — заменяем. Не выбрали — оставляем старое.
  if (imageUrl) update.image_url = imageUrl;

  const { error } = await admin
    .from("rewards")
    .update(update)
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

  await checkAndApplyLevelUp(request.user_id, admin);

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

  await notifyUser(
    admin,
    request.user_id,
    `✅ Заявка на бонус одобрена — +${coins} coins`
  );

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

    await checkAndApplyLevelUp(userId, admin);

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

    if (amount > 0) {
      await checkAndApplyLevelUp(userId, admin);
    }

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
    .update({ balance: 0, total_earned: 0, month_earned: 0, last_level_id: 1 })
    .eq("role", "mop")
    .eq("is_active", true)
    .eq("is_guest", false);

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
    .update({ balance: 0, total_earned: 0, month_earned: 0, last_level_id: 1 })
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

// ---------- Удаление сотрудника ----------

// Увольнение: история (заявки, транзакции, сообщения) НЕ удаляется —
// только обнуляем баланс (одной видимой транзакцией, чтобы было понятно
// куда делись коины) и прячем человека из активных списков/рейтинга.
// Раньше эта функция физически удаляла аккаунт и каскадом сносила всю
// историю — из-за этого нельзя было потом посмотреть, кто сколько
// заработал до увольнения.
export async function offboardEmployee(userId) {
  const admin_user = await requireAdmin();
  if (userId === admin_user.id) {
    return { error: "Нельзя уволить самого себя" };
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("users")
    .select("balance")
    .eq("id", userId)
    .single();

  if (!profile) return { error: "Сотрудник не найден" };

  if (profile.balance > 0) {
    await admin.from("transactions").insert({
      user_id: userId,
      type: "manual_subtract",
      amount_coins: -profile.balance,
      description: "Списание при увольнении",
      rating_exempt: true,
    });
  }

  const { error } = await admin
    .from("users")
    .update({ balance: 0, is_active: false })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/employees");
  revalidatePath("/admin/rating");
  revalidatePath("/mop/rating");
  revalidatePath("/observer");
  revalidatePath("/observer/rating");

  return { success: true };
}

// Отмена увольнения — возвращает в активные списки/рейтинг.
// Баланс, списанный при увольнении, сознательно не восстанавливается
// (это было бы неожиданным начислением) — при необходимости админ
// может начислить заново через "Баланс" в карточке сотрудника.
export async function reinstateEmployee(userId) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("users")
    .update({ is_active: true })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/employees");
  revalidatePath("/admin/rating");
  revalidatePath("/mop/rating");
  revalidatePath("/observer");
  revalidatePath("/observer/rating");

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

// ---------- Полная перестановка категорий (drag-and-drop) ----------

export async function reorderCategories(orderedIds) {
  await requireAdmin();
  const admin = createAdminClient();

  for (let i = 0; i < orderedIds.length; i++) {
    await admin
      .from("reward_categories")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
  }

  revalidatePath("/admin/rewards");
  revalidatePath("/mop/shop");
  return { success: true };
}

// ---------- Массовое подтверждение/отклонение ----------

export async function bulkApproveRevenue(ids) {
  for (const id of ids) {
    await approveRevenueRequest(id);
  }
  return { success: true, count: ids.length };
}

export async function bulkRejectRevenue(ids) {
  for (const id of ids) {
    await rejectRevenueRequest(id);
  }
  return { success: true, count: ids.length };
}

export async function bulkApproveBonus(ids) {
  for (const id of ids) {
    await approveBonusRequest(id);
  }
  return { success: true, count: ids.length };
}

export async function bulkRejectBonus(ids) {
  for (const id of ids) {
    await rejectBonusRequest(id);
  }
  return { success: true, count: ids.length };
}
