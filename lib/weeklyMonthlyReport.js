import { createAdminClient } from "@/lib/supabase-admin";

// Возвращает [{ name, total }] — выручка в тенге за период, отсортировано
// по убыванию. Источник тот же, что у рейтинга на сайте и у картинки в
// Телеграме: отчёт в общий чат не имеет права расходиться с рейтингом.
// start/end — ISO-строки UTC, диапазон [start, end).
export async function getEarningsForRange({ start, end }) {
  const admin = createAdminClient();

  const [{ data: users }, { data: revenueRows }] = await Promise.all([
    admin
      .from("users")
      .select("id, name")
      .in("role", ["mop", "observer"])
      .eq("is_active", true)
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local"),
    admin.rpc("rating_revenue", { p_start: start, p_end: end }),
  ]);

  if (!users || users.length === 0) return [];

  const totals = new Map(users.map((u) => [u.id, 0]));
  for (const row of revenueRows ?? []) {
    if (totals.has(row.user_id)) totals.set(row.user_id, Number(row.total) || 0);
  }

  return users
    .map((u) => ({ name: u.name, total: totals.get(u.id) ?? 0 }))
    .sort((a, b) => b.total - a.total);
}
