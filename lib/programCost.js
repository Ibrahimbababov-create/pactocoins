// Сколько PactoCoins стоит компании за период — по ВЫДАННЫМ коинам, а не
// по потраченным: каждый выданный коин рано или поздно потратят (решение
// Ибрагима, октябрь 2026).
//
// База — «Прибыль компании (выручка − ФОТ)» из таблицы финансов: прибыль
// после зарплат команд, но до офиса и прочих расходов. С чистой прибылью
// не сравниваем: её качают аренда и разовые траты, к продажам отношения
// не имеющие (август 0,04 млн, октябрь 1,19 млн). В среднем за июнь–
// сентябрь 2026 эта прибыль — 4,21% от кассы клиентов. Бюджет программы —
// 5–10% этой прибыли. Поменялась маржа — поправь NET_MARGIN.
export const NET_MARGIN = 0.042;
export const BUDGET_SHARE = { ok: 0.07, max: 0.1 };
const FALLBACK_KZT_PER_COIN = 2;

const SOURCE_LABELS = {
  revenue: "Выручка",
  bonus: "Бонусы и призы, прочее",
  birthday: "Дни рождения",
  wheel: "Колесо (выигрыши минус купленные крутки)",
  manual: "Ручные начисления",
};

// «Бонусы и призы» одной строкой ничего не объясняли: туда падали и топ
// недели, и наставникам, и турнир, и старый месячный приз. Делим по
// описанию начисления, чтобы было видно, что именно дорожает.
const BONUS_KINDS = [
  [/Топ-3 за прошлую неделю/, "Топ-3 недели"],
  [/Топ-3 за прошлый месяц/, "Приз за месяц (старая схема, отменён)"],
  [/турнир/i, "Турниры, добавка Pacto"],
  [/^Бонус: /, "Бонусы по заявкам"],
];
const bonusKind = (description) =>
  BONUS_KINDS.find(([re]) => re.test(description ?? ""))?.[1] ?? SOURCE_LABELS.bonus;

export async function getProgramCost(admin, { start, end }) {
  const since90 = new Date(Date.now() - 90 * 86400000).toISOString();

  const [{ data: people }, { data: revenueRows }, { data: bought }] = await Promise.all([
    admin
      .from("users")
      .select("id")
      .eq("is_guest", false)
      .neq("role", "admin")
      .not("email", "like", "%.test@pactocoins.local"),
    admin.rpc("rating_revenue", { p_start: start, p_end: end }),
    admin
      .from("purchase_requests")
      .select("price_coins, actual_kzt_amount, kzt_amount")
      .neq("status", "rejected")
      .gte("created_at", since90),
  ]);

  const ids = (people ?? []).map((p) => p.id);
  const idSet = new Set(ids);

  // Транзакции за период — постранично, их бывает больше тысячи.
  const tx = [];
  for (let from = 0; ids.length; from += 1000) {
    const { data } = await admin
      .from("transactions")
      .select("user_id, amount_coins, source, description")
      .gte("created_at", start)
      .lt("created_at", end)
      .range(from, from + 999);
    if (!data?.length) break;
    tx.push(...data.filter((t) => idSet.has(t.user_id)));
    if (data.length < 1000) break;
  }

  // Возвраты за отклонённые покупки — это старые коины, не новые.
  // Колесо считаем чистым: выигрыши минус купленные крутки.
  // Остальное — только начисления (списания в магазине — это трата).
  const bySource = {};
  // Наставнику 1% от продаж его стажёров, а стажёрам на 1% меньше ЗП:
  // компании это в ноль, поэтому в стоимость программы не идёт.
  let mentorCoins = 0;
  for (const t of tx) {
    const src = String(t.source ?? "manual");
    if (src === "refund") continue;
    const amt = Number(t.amount_coins) || 0;
    if (src !== "wheel" && amt <= 0) continue;
    if (/Наставничество/.test(t.description ?? "")) {
      mentorCoins += amt;
      continue;
    }
    const key = src === "bonus" ? bonusKind(t.description) : SOURCE_LABELS[src] ?? src;
    bySource[key] = (bySource[key] ?? 0) + amt;
  }
  const issuedCoins = Object.values(bySource).reduce((s, v) => s + v, 0);

  // Курс коина — по тому, во сколько реально обходились покупки.
  let coinsBought = 0;
  let kztSpent = 0;
  for (const p of bought ?? []) {
    const kzt = p.actual_kzt_amount ?? p.kzt_amount;
    if (kzt == null || !p.price_coins) continue;
    coinsBought += p.price_coins;
    kztSpent += kzt;
  }
  const kztPerCoin = coinsBought > 1000 ? kztSpent / coinsBought : FALLBACK_KZT_PER_COIN;

  const revenueKzt = (revenueRows ?? []).reduce((s, r) => s + (Number(r.total) || 0), 0);
  const profitKzt = revenueKzt * NET_MARGIN;
  const costKzt = issuedCoins * kztPerCoin;

  return {
    revenueKzt,
    profitKzt,
    issuedCoins,
    costKzt,
    kztPerCoin,
    share: profitKzt > 0 ? costKzt / profitKzt : null,
    mentorCoins,
    mentorKzt: mentorCoins * kztPerCoin,
    breakdown: Object.entries(bySource)
      .map(([label, coins]) => ({ label, coins, kzt: coins * kztPerCoin }))
      .sort((a, b) => b.coins - a.coins),
  };
}
