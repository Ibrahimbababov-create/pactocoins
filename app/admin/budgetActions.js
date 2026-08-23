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

export async function addBudgetTopup(formData) {
  const admin_user = await requireAdmin();
  const admin = createAdminClient();

  const amount = Number(formData.get("amount_kzt"));
  const note = (formData.get("note")?.toString() || "").trim();
  const givenAt = formData.get("given_at")?.toString() || null;

  if (!amount || amount <= 0) return { error: "Укажи сумму больше нуля" };

  const { error } = await admin.from("budget_topups").insert({
    amount_kzt: amount,
    note: note || null,
    given_at: givenAt || undefined,
    created_by: admin_user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/budget");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteBudgetTopup(topupId) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("budget_topups")
    .delete()
    .eq("id", topupId);

  if (error) return { error: error.message };

  revalidatePath("/admin/budget");
  revalidatePath("/admin");
  return { success: true };
}

export async function updatePurchaseActualSpend(purchaseId, amount) {
  await requireAdmin();
  const admin = createAdminClient();

  const value = amount === "" || amount === null ? null : Number(amount);
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    return { error: "Некорректная сумма" };
  }

  const { error } = await admin
    .from("purchase_requests")
    .update({ actual_kzt_amount: value })
    .eq("id", purchaseId);

  if (error) return { error: error.message };

  revalidatePath("/admin/purchase-requests");
  revalidatePath("/admin/budget");
  revalidatePath("/admin");
  return { success: true };
}
