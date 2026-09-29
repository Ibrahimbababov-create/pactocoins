import {
  thisWeekRangeAlmaty,
  monthRangeAlmaty,
  currentMonthKeyAlmaty,
} from "@/lib/timezone";

// Рейтинг за период — выручка в тенге по подтверждённым оплатам. Считается
// ровно так же, как на экране рейтинга в приложении (lib/ratingData.js),
// чтобы картинка в Телеграме и сайт никогда не расходились: бонусы, колесо
// и ручные начисления в коинах на рейтинг не влияют.
// period: "week" | "month". Возвращает { rows: [{name,total,deals}], label }.
export async function getPeriodRanking(admin, period) {
  const range =
    period === "month"
      ? monthRangeAlmaty(currentMonthKeyAlmaty())
      : thisWeekRangeAlmaty();

  const [{ data: users }, { data: revenueRows }] = await Promise.all([
    admin
      .from("users")
      .select("id, name")
      .eq("role", "mop")
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local"),
    admin.rpc("rating_revenue", { p_start: range.start, p_end: range.end }),
  ]);

  const nameById = Object.fromEntries((users ?? []).map((u) => [u.id, u.name]));

  const rows = (revenueRows ?? [])
    .filter((r) => nameById[r.user_id] && Number(r.total) > 0)
    .map((r) => ({
      name: nameById[r.user_id],
      total: Number(r.total),
      deals: Number(r.deals) || 0,
    }))
    .sort((a, b) => b.total - a.total);

  return { rows, label: range.label };
}
