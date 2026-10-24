import { tieredRevenueCoins } from "@/lib/coinRate";
import { monthRevenueBefore } from "@/lib/revenueMonth";

// Сколько коинов реально начислится, если одобрить заявку сейчас: по шкале
// месяца и личному множителю — так же, как считает одобрение. В заявке
// лежит calculated_coins по базовой ставке, и админ видел «52 коина»,
// хотя по шкале выходило вдвое больше. Возвращает { [requestId]: coins }.
export async function forecastRevenueCoins(admin, pendingRows) {
  const rows = pendingRows ?? [];
  if (!rows.length) return {};

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: users } = await admin
    .from("users")
    .select("id, coin_rate_multiplier")
    .in("id", userIds);
  const mult = Object.fromEntries((users ?? []).map((u) => [u.id, u.coin_rate_multiplier]));

  const pairs = await Promise.all(
    rows.map(async (r) => {
      const earnedAt = r.earned_at ?? r.created_at;
      const before = await monthRevenueBefore(admin, r.user_id, earnedAt, r.id);
      return [r.id, tieredRevenueCoins(r.amount_kzt, mult[r.user_id] ?? 1, before)];
    })
  );
  return Object.fromEntries(pairs);
}
