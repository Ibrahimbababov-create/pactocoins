"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { buildCsv } from "@/lib/csv";
import { monthRangeAlmaty, formatDateTimeAlmaty } from "@/lib/timezone";
import { fetchMonthPurchases, filterPurchases } from "@/lib/purchasesMoney";

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
}

const STATUS_LABEL = { approved: "Одобрена", done: "Выполнена" };

// Таблица покупок месяца с теми же фильтрами, что на экране.
export async function exportPurchasesCsv(monthKey, nameQuery, rewardQuery) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: e.message };
  }
  if (!/^\d{4}-\d{2}$/.test(String(monthKey))) return { error: "Некорректный месяц" };

  const admin = createAdminClient();
  const rows = filterPurchases(
    await fetchMonthPurchases(admin, monthRangeAlmaty(monthKey)),
    nameQuery,
    rewardQuery
  );
  const header = [
    "Дата (Алматы)",
    "Сотрудник",
    "Награда",
    "Коины",
    "Потрачено по факту, ₸",
    "Оценка, ₸",
    "Статус",
  ];
  const data = rows.map((p) => [
    formatDateTimeAlmaty(p.created_at),
    (p.users?.name ?? "") + (p.users?.is_active === false ? " (уволен)" : ""),
    (p.rewards?.title ?? "") + (p.variant_label ? ` - ${p.variant_label}` : ""),
    p.price_coins ?? 0,
    p.actual_kzt_amount ?? "",
    p.kzt_amount ?? "",
    STATUS_LABEL[p.status] ?? p.status,
  ]);
  return { csv: buildCsv(header, data) };
}
