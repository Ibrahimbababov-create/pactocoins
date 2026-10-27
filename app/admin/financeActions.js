"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { saveMonthFinance } from "@/lib/programCost";

const toKzt = (v) => Math.round(Number(String(v ?? "").replace(/[^\d]/g, "")));

// Прибыль компании за месяц из таблицы финансов (выручка − ФОТ): сумма «на
// сегодня» и необязательная сумма «к концу месяца». Пустое прогнозное поле
// очищает прогноз, пустое «сейчас» не трогает уже сохранённое.
export async function setMonthProfit(monthKey, profitRaw, forecastRaw) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: "Доступ запрещён" };
  if (!/^\d{4}-\d{2}$/.test(String(monthKey))) return { error: "Неверный месяц" };

  const patch = {};
  if (String(profitRaw ?? "").trim() !== "") {
    const kzt = toKzt(profitRaw);
    if (!kzt || kzt < 0) return { error: "Впиши сумму в тенге, например 2310138" };
    patch.profit = kzt;
  }
  if (forecastRaw !== undefined) {
    if (String(forecastRaw ?? "").trim() === "") patch.forecast = null;
    else {
      const f = toKzt(forecastRaw);
      if (!f || f < 0) return { error: "Прогноз впиши суммой в тенге или оставь пустым" };
      patch.forecast = f;
    }
  }
  if (!Object.keys(patch).length) return { error: "Нечего сохранять" };
  const res = await saveMonthFinance(createAdminClient(), monthKey, patch);
  revalidatePath("/admin");
  return res;
}
