import {
  thisWeekRangeAlmaty,
  monthRangeAlmaty,
  currentMonthKeyAlmaty,
} from "@/lib/timezone";

// Общий рейтинг за период — сумма реального заработка (rating_exempt=false,
// положительные транзакции) активных МОПов/РОПов, без гостя и тестовых.
// period: "week" | "month". Возвращает { rows: [{name,total}], label }.
export async function getPeriodRanking(admin, period) {
  const range =
    period === "month"
      ? monthRangeAlmaty(currentMonthKeyAlmaty())
      : thisWeekRangeAlmaty();

  const { data: users } = await admin
    .from("users")
    .select("id, name")
    .in("role", ["mop", "rop"])
    .eq("is_active", true)
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local");

  const ids = (users ?? []).map((u) => u.id);
  const nameById = Object.fromEntries((users ?? []).map((u) => [u.id, u.name]));

  let rows = [];
  if (ids.length) {
    const { data: tx } = await admin
      .from("transactions")
      .select("user_id, amount_coins")
      .in("user_id", ids)
      .eq("rating_exempt", false)
      .gt("amount_coins", 0)
      .gte("created_at", range.start)
      .lt("created_at", range.end);

    const totals = {};
    for (const t of tx ?? []) {
      totals[t.user_id] = (totals[t.user_id] ?? 0) + t.amount_coins;
    }
    rows = Object.entries(totals)
      .map(([id, total]) => ({ name: nameById[id] ?? "—", total }))
      .sort((a, b) => b.total - a.total);
  }

  return { rows, label: range.label };
}
