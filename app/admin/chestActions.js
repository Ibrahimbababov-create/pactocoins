"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { chestEligible } from "@/lib/chest";

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

// Положить подарок в сундук: всем сотрудникам или одному (userId). Открыть
// его можно один раз (chest_claims). Подарок лежит, пока его не убрали.
// Коины в сундуке — настоящие деньги программы, считаются в бюджете.
export async function putChestGift(input) {
  const user = await requireAdmin();
  const admin = createAdminClient();
  const title = (input?.title || "").toString().trim().slice(0, 60) || "Подарок от Pacto";
  const chips = Math.max(0, Math.min(1000, Math.round(Number(input?.chips) || 0)));
  const spins = Math.max(0, Math.min(50, Math.round(Number(input?.spins) || 0)));
  const coins = Math.max(0, Math.min(5000, Math.round(Number(input?.coins) || 0)));
  if (chips === 0 && spins === 0 && coins === 0) return { error: "Положи фишки, крутки или коины" };

  let userId = null;
  if (input?.userId) {
    const { data: person } = await admin
      .from("users")
      .select("id, role, is_active, is_guest, email")
      .eq("id", input.userId)
      .maybeSingle();
    if (!chestEligible(person)) return { error: "Этому человеку сундук не покажется" };
    userId = person.id;
  }

  const { error } = await admin
    .from("chest_gifts")
    .insert({ title, chips, spins, coins, user_id: userId, created_by: user.id });
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
