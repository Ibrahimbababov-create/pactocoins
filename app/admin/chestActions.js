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
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Доступ запрещён");
  return user;
}

function refresh() {
  revalidatePath("/admin/wheel");
  revalidatePath("/mop");
  revalidatePath("/mop/games");
}

// Положить подарок в сундук: у каждого сотрудника появится сундук, открыть
// его можно один раз (chest_claims). Подарок лежит, пока его не убрали.
export async function putChestGift(input) {
  const user = await requireAdmin();
  const title = (input?.title || "").toString().trim().slice(0, 60) || "Подарок от Pacto";
  const chips = Math.max(0, Math.min(1000, Math.round(Number(input?.chips) || 0)));
  const spins = Math.max(0, Math.min(50, Math.round(Number(input?.spins) || 0)));
  if (chips === 0 && spins === 0) return { error: "Положи фишки или крутки" };

  const { error } = await createAdminClient()
    .from("chest_gifts")
    .insert({ title, chips, spins, created_by: user.id });
  if (error) return { error: "Не получилось положить, попробуй ещё раз" };
  refresh();
  return { success: true };
}

// Убрать подарок: кто не успел открыть, его уже не получит.
export async function removeChestGift(id) {
  await requireAdmin();
  const { error } = await createAdminClient().from("chest_gifts").update({ is_active: false }).eq("id", id);
  if (error) return { error: "Не получилось убрать, попробуй ещё раз" };
  refresh();
  return { success: true };
}
