import { almatyDayKey, nowInAlmaty } from "@/lib/timezone";
import { readConfigJson, writeConfigJson } from "@/lib/configStore";

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

// Прикидка по кассе не видит фиксы: проект с фиксом даёт прибыль без
// кассы. Поэтому раз в месяц админ вписывает точную «Прибыль компании»
// из таблицы финансов, и процент считается от неё. Хранится JSON в
// закрытом бакете app-config, схема базы не меняется.
const PROFIT_FILE = "finance.json";
// Уже известное из таблицы на 22.10.2026; вписанное в админке важнее.
const KNOWN_PROFIT = { "2026-09": 1722743, "2026-10": 2310138 };

// Читаем файл по свежей подписанной ссылке с «меткой времени» в адресе:
// обычное скачивание Storage иногда отдаёт старую копию из кэша после
// перезаписи файла, и сохранённая цифра выглядела несохранённой.
async function readProfitFile(admin) {
  return readConfigJson(admin, PROFIT_FILE, null);
}

// Сумма «на сегодня» и необязательный прогноз «к концу месяца» лежат в одном
// файле: { profit: {месяц: сумма}, forecast: {месяц: сумма} }. Старый файл
// без forecast читается как раньше.
export async function getMonthFinance(admin) {
  try {
    const parsed = await readProfitFile(admin);
    return { profit: { ...KNOWN_PROFIT, ...(parsed?.profit ?? {}) }, forecast: { ...(parsed?.forecast ?? {}) } };
  } catch {
    return { profit: { ...KNOWN_PROFIT }, forecast: {} };
  }
}

export async function getMonthProfits(admin) {
  return (await getMonthFinance(admin)).profit;
}

// patch: { profit?: число, forecast?: число | null }. Не переданное не
// трогаем, forecast: null очищает прогнозную сумму.
export async function saveMonthFinance(admin, monthKey, patch) {
  const saved = (await readProfitFile(admin)) ?? {};
  const profit = { ...(saved.profit ?? {}) };
  const forecast = { ...(saved.forecast ?? {}) };
  if (patch.profit !== undefined) profit[monthKey] = patch.profit;
  if (patch.forecast !== undefined) {
    if (patch.forecast === null) delete forecast[monthKey];
    else forecast[monthKey] = patch.forecast;
  }
  return writeConfigJson(admin, PROFIT_FILE, { profit, forecast, updatedAt: new Date().toISOString() });
}

export async function saveMonthProfit(admin, monthKey, kzt) {
  return saveMonthFinance(admin, monthKey, { profit: kzt });
}
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

export async function getProgramCost(admin, { start, end, monthKey }) {
  const since90 = new Date(Date.now() - 90 * 86400000).toISOString();

  const [{ data: people }, { data: revenueRows }, { data: bought }, profits] = await Promise.all([
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
    getMonthFinance(admin),
  ]);

  const ids = (people ?? []).map((p) => p.id);
  const idSet = new Set(ids);

  // Транзакции за период — постранично, их бывает больше тысячи.
  const tx = [];
  for (let from = 0; ids.length; from += 1000) {
    const { data } = await admin
      .from("transactions")
      .select("user_id, amount_coins, source, description, created_at")
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
  // Выдано по дням (Алматы) — для прогноза; те же правила, что и в сумме.
  const dailyIssued = {};
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
    const day = almatyDayKey(t.created_at);
    dailyIssued[day] = (dailyIssued[day] ?? 0) + amt;
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
  const tableProfit = monthKey ? Number(profits.profit[monthKey]) || null : null;
  const forecastProfit = monthKey ? Number(profits.forecast[monthKey]) || null : null;
  const estimatedProfitKzt = revenueKzt * NET_MARGIN;
  const profitKzt = tableProfit ?? estimatedProfitKzt;
  const costKzt = issuedCoins * kztPerCoin;

  return {
    revenueKzt,
    profitKzt,
    profitFromTable: tableProfit != null,
    forecastProfit,
    estimatedProfitKzt,
    issuedCoins,
    costKzt,
    kztPerCoin,
    share: profitKzt > 0 ? costKzt / profitKzt : null,
    dailyIssued,
    mentorCoins,
    mentorKzt: mentorCoins * kztPerCoin,
    breakdown: Object.entries(bySource)
      .map(([label, coins]) => ({ label, coins, kzt: coins * kztPerCoin }))
      .sort((a, b) => b.coins - a.coins),
  };
}

// Прогноз расхода программы к концу месяца. Формулы стоимости не трогает:
// берёт готовый результат getProgramCost. Платежи копятся к концу месяца,
// поэтому даём диапазон: от среднего за весь месяц до среднего за 7 дней.
// Работает только для текущего месяца; для прошлых возвращает null.
export function getBudgetForecast(cost, monthKey) {
  const now = nowInAlmaty();
  const key = `${now.year}-${String(now.month).padStart(2, "0")}`;
  if (monthKey !== key) return null;

  const daysInMonth = new Date(Date.UTC(now.year, now.month, 0)).getUTCDate();
  const today = now.day;
  const done = today - 1; // полностью прошедшие дни
  if (done < 3) return { tooEarly: true };

  const dayKeyOf = (d) => `${key}-${String(d).padStart(2, "0")}`;
  const sumDays = (from, to) => {
    let s = 0;
    for (let d = from; d <= to; d++) s += cost.dailyIssued?.[dayKeyOf(d)] ?? 0;
    return s;
  };
  const avgMonth = sumDays(1, done) / done;
  const n7 = Math.min(7, done);
  const avg7 = sumDays(done - n7 + 1, done) / n7;
  const restDays = daysInMonth - today;
  const issued = cost.issuedCoins;
  const lowAvg = Math.min(avgMonth, avg7);
  const highAvg = Math.max(avgMonth, avg7);
  const low = Math.round(issued + restDays * lowAvg);
  const high = Math.round(issued + restDays * highAvg);
  const mid = (low + high) / 2;

  const withProfit = cost.profitFromTable && cost.profitKzt > 0;
  // Прибыль из таблицы вписывают по ходу месяца (в базе известных цифр
  // 2 310 138 ₸ «на 22.10»), то есть это нарастающий итог на сегодня. К концу
  // месяца она вырастет вместе с выручкой, поэтому делить прогноз коинов на
  // сегодняшнюю прибыль нельзя: процент завышается. Растим прибыль по темпу.
  const profitNow = cost.profitKzt;
  // Если владелец вписал ожидаемую сумму к концу месяца, считаем от неё.
  const profitEndManual = withProfit && cost.forecastProfit > 0;
  const profitEnd = withProfit
    ? profitEndManual
      ? cost.forecastProfit
      : (profitNow * daysInMonth) / done
    : null;
  const pctOf = (coins) => (withProfit ? (coins * cost.kztPerCoin) / profitEnd : null);
  const ceilingCoins = withProfit ? (profitEnd * BUDGET_SHARE.max) / cost.kztPerCoin : null;
  const left = ceilingCoins == null ? null : Math.round(ceilingCoins - issued);

  // Когда упрёмся в потолок при среднем темпе.
  let ceilingDay = null;
  const midAvg = (avgMonth + avg7) / 2;
  if (left != null && left > 0 && midAvg > 0) {
    const d = today + Math.ceil(left / midAvg);
    if (d <= daysInMonth) ceilingDay = d;
  }

  const total = cost.breakdown.reduce((s, b) => s + b.coins, 0) || 1;
  const top = cost.breakdown
    .filter((b) => b.coins > 0)
    .slice(0, 3)
    .map((b) => ({ label: b.label, share: b.coins / total, coins: Math.round((b.coins / total) * mid) }));

  return {
    avgMonth,
    avg7,
    low,
    high,
    pctLow: pctOf(low),
    pctHigh: pctOf(high),
    pctNow: withProfit && profitNow > 0 ? (issued * cost.kztPerCoin) / profitNow : null,
    profitEnd,
    profitEndManual,
    withProfit,
    left,
    leftKzt: left == null ? null : left * cost.kztPerCoin,
    ceilingDate: ceilingDay
      ? `${String(ceilingDay).padStart(2, "0")}.${String(now.month).padStart(2, "0")}`
      : null,
    top,
  };
}
