"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { notifyUser } from "@/lib/notifyUser";

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

const PRIZE_TYPES = ["nothing", "coins", "spins", "custom"];

export async function saveWheelSegment(input) {
  await requireAdmin();
  const admin = createAdminClient();

  const label = (input.label || "").toString().trim();
  if (!label) return { error: "Впиши название сектора" };

  const row = {
    label,
    weight: Math.max(1, Math.round(Number(input.weight) || 1)),
    prize_type: PRIZE_TYPES.includes(input.prize_type)
      ? input.prize_type
      : "nothing",
    prize_amount: Math.max(0, Math.round(Number(input.prize_amount) || 0)),
    color: (input.color || "").toString().trim() || null,
    sort_order: Math.round(Number(input.sort_order) || 0),
    is_active: input.is_active !== false,
  };

  const q = input.id
    ? admin.from("wheel_segments").update(row).eq("id", input.id)
    : admin.from("wheel_segments").insert(row);
  const { error } = await q;
  if (error) return { error: error.message };

  revalidatePath("/admin/wheel");
  revalidatePath("/mop/wheel");
  return { success: true };
}

export async function deleteWheelSegment(id) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("wheel_segments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/wheel");
  revalidatePath("/mop/wheel");
  return { success: true };
}

export async function saveWheelConfig({
  spin_price_coins,
  buy_enabled,
  is_open,
  opens_at,
}) {
  await requireAdmin();
  const admin = createAdminClient();

  const patch = {
    spin_price_coins: Math.max(1, Math.round(Number(spin_price_coins) || 150)),
    buy_enabled: !!buy_enabled,
    is_open: !!is_open,
  };
  // opens_at: строка из <input type="datetime-local"> по Алматы, либо пусто
  if (opens_at === "" || opens_at === null) {
    patch.opens_at = null;
  } else if (typeof opens_at === "string") {
    patch.opens_at = new Date(`${opens_at}:00+05:00`).toISOString();
  }

  const { error } = await admin
    .from("wheel_config")
    .update(patch)
    .eq("id", true);
  if (error) return { error: error.message };
  revalidatePath("/admin/wheel");
  revalidatePath("/mop/wheel");
  return { success: true };
}

async function addSpins(admin, userIds, count) {
  const n = Math.round(Number(count) || 0);
  if (!n || !userIds.length) return { count: 0 };

  const { data: rows } = await admin
    .from("users")
    .select("id, wheel_spins")
    .in("id", userIds);

  let done = 0;
  for (const r of rows ?? []) {
    const next = Math.max(0, (r.wheel_spins ?? 0) + n);
    await admin.from("users").update({ wheel_spins: next }).eq("id", r.id);
    if (n > 0) {
      await notifyUser(
        admin,
        r.id,
        `🎡 Тебе начислили ${n} ${n === 1 ? "крутку" : "крутки"} на колесо фортуны`,
        "notify_shop"
      );
    }
    done++;
  }
  return { count: done };
}

export async function grantSpins(userId, count) {
  await requireAdmin();
  const admin = createAdminClient();
  if (!userId) return { error: "Выбери сотрудника" };
  const res = await addSpins(admin, [userId], count);
  revalidatePath("/admin/wheel");
  return { success: true, ...res };
}

export async function grantSpinsBulk(userIds, count) {
  await requireAdmin();
  const admin = createAdminClient();
  const ids = (userIds ?? []).filter(Boolean);
  if (!ids.length) return { error: "Никто не выбран" };
  const res = await addSpins(admin, ids, count);
  revalidatePath("/admin/wheel");
  return { success: true, ...res };
}
