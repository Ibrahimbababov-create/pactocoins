import { almatyDayKey, monthRangeAlmaty } from "@/lib/timezone";

// Итог месяца одного сотрудника. Только его собственные оплаты, а из
// рейтинга берём лишь место и число участников: чужих сумм здесь нет.
// Условие по датам такое же, как в рейтинге (rating_revenue):
// дата оплаты earned_at, а у совсем старых заявок - дата подачи.
function rangeFilter(range) {
  return `and(earned_at.gte.${range.start},earned_at.lt.${range.end}),and(earned_at.is.null,created_at.gte.${range.start},created_at.lt.${range.end})`;
}

export function prevMonthKey(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getMonthRecap(supabase, userId, monthKey) {
  const range = monthRangeAlmaty(monthKey);
  const prevRange = monthRangeAlmaty(prevMonthKey(monthKey));

  const [
    { data: rows },
    { data: prevRows },
    { data: coinRows },
    { data: ratingUsers },
    { data: ratingRows },
  ] = await Promise.all([
    supabase
      .from("revenue_requests")
      .select("amount_kzt, earned_at, created_at")
      .eq("user_id", userId)
      .eq("status", "approved")
      .or(rangeFilter(range)),
    supabase
      .from("revenue_requests")
      .select("amount_kzt")
      .eq("user_id", userId)
      .eq("status", "approved")
      .or(rangeFilter(prevRange)),
    supabase
      .from("transactions")
      .select("amount_coins")
      .eq("user_id", userId)
      .eq("source", "revenue")
      .gt("amount_coins", 0)
      .gte("created_at", range.start)
      .lt("created_at", range.end),
    supabase
      .from("users")
      .select("id")
      .in("role", ["mop", "observer"])
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local"),
    supabase.rpc("rating_revenue", { p_start: range.start, p_end: range.end }),
  ]);

  const total = (rows ?? []).reduce((s, r) => s + (Number(r.amount_kzt) || 0), 0);
  const prevTotal = (prevRows ?? []).reduce((s, r) => s + (Number(r.amount_kzt) || 0), 0);
  const coins = (coinRows ?? []).reduce((s, r) => s + (Number(r.amount_coins) || 0), 0);

  // Лучший день и лучшая оплата
  const byDay = {};
  let bestPayment = null;
  for (const r of rows ?? []) {
    const at = r.earned_at || r.created_at;
    const amount = Number(r.amount_kzt) || 0;
    const key = almatyDayKey(at);
    byDay[key] = (byDay[key] ?? 0) + amount;
    if (!bestPayment || amount > bestPayment.amount) bestPayment = { amount, at };
  }
  let bestDay = null;
  for (const [key, value] of Object.entries(byDay)) {
    if (!bestDay || value > bestDay.value) bestDay = { key, value };
  }
  if (bestDay) bestDay.at = `${bestDay.key}T12:00:00+05:00`;

  // Место среди тех, кто в рейтинге и заработал в этом месяце
  const ids = new Set((ratingUsers ?? []).map((u) => u.id));
  let place = null;
  let ranked = 0;
  if (ids.has(userId)) {
    const totals = (ratingRows ?? [])
      .filter((r) => ids.has(r.user_id))
      .map((r) => ({ id: r.user_id, value: Number(r.total) || 0 }))
      .filter((r) => r.value > 0);
    ranked = totals.length;
    const mine = totals.find((r) => r.id === userId)?.value ?? 0;
    if (mine > 0) place = totals.filter((r) => r.value > mine).length + 1;
  }

  const changePct =
    prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  return {
    label: range.label,
    total,
    deals: (rows ?? []).length,
    bestDay,
    bestPayment,
    place,
    ranked,
    coins,
    prevTotal,
    changePct,
  };
}
