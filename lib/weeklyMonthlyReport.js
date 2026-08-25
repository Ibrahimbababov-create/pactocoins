import { createAdminClient } from "@/lib/supabase-admin";

// Возвращает [{ name, total }] по всем МОПам, отсортировано по total desc.
// start/end — ISO-строки UTC, диапазон [start, end).
export async function getEarningsForRange({ start, end }) {
  const admin = createAdminClient();

  const { data: users } = await admin
    .from("users")
    .select("id, name")
    .eq("role", "mop")
    .eq("is_active", true);

  if (!users || users.length === 0) return [];

  const userIds = users.map((u) => u.id);

  const { data: transactions } = await admin
    .from("transactions")
    .select("user_id, amount_coins")
    .in("user_id", userIds)
    .eq("rating_exempt", false)
    .gt("amount_coins", 0)
    .gte("created_at", start)
    .lt("created_at", end);

  const totals = new Map(users.map((u) => [u.id, 0]));
  for (const t of transactions ?? []) {
    totals.set(t.user_id, (totals.get(t.user_id) ?? 0) + t.amount_coins);
  }

  return users
    .map((u) => ({ name: u.name, total: totals.get(u.id) ?? 0 }))
    .sort((a, b) => b.total - a.total);
}
