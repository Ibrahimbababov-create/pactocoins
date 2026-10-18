"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { chestEligible } from "@/lib/chest";

// Открыть сундук. Всё содержимое начисляет claim_chest одним запросом:
// отметка «открыл» и фишки/крутки на счёт либо вместе, либо никак.
export async function openChest() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role, is_active, is_guest, email")
    .eq("id", user.id)
    .single();
  if (!chestEligible(profile)) return { error: "Этот сундук не для тебя" };

  const { data: res, error } = await admin.rpc("claim_chest", { uid: user.id });
  if (error) return { error: "Не получилось открыть, попробуй ещё раз" };
  if (res?.error === "empty") return { error: "Сундук уже открыт" };
  if (!res?.ok) return { error: "Не получилось открыть, попробуй ещё раз" };

  revalidatePath("/mop");
  revalidatePath("/mop/games");
  revalidatePath("/mop/games/wheel");
  return {
    ok: true,
    chips: res.chips ?? 0,
    spins: res.spins ?? 0,
    totalChips: res.total_chips ?? 0,
    totalSpins: res.total_spins ?? 0,
  };
}
