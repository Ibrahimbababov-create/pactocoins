"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { saveMonthProfit } from "@/lib/programCost";

// Прибыль компании за месяц из таблицы финансов (выручка − ФОТ).
export async function setMonthProfit(monthKey, raw) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: "Доступ запрещён" };
  if (!/^\d{4}-\d{2}$/.test(String(monthKey))) return { error: "Неверный месяц" };
  const kzt = Math.round(Number(String(raw ?? "").replace(/[^\d]/g, "")));
  if (!kzt || kzt < 0) return { error: "Впиши сумму в тенге, например 2310138" };
  const res = await saveMonthProfit(createAdminClient(), monthKey, kzt);
  revalidatePath("/admin");
  return res;
}
