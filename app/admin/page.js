import { formatCoins } from "@/lib/plural";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import ResetButton from "@/components/ResetButton";
import MonthPicker from "@/components/MonthPicker";
import ThemePicker from "@/components/ThemePicker";
import { themeOrDefault } from "@/lib/themes";
import AdminQueueNext from "@/components/AdminQueueNext";
import Icon from "@/components/Icon";
import {
  monthRangeAlmaty,
  currentMonthKeyAlmaty,
  recentMonthKeysAlmaty,
} from "@/lib/timezone";
import { getEarnedMap } from "@/lib/earnings";
import ViewAsSwitch from "@/components/ViewAsSwitch";
import { viewAsRole, isViewableRole } from "@/lib/viewAs";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";
import { getProgramCost, BUDGET_SHARE, NET_MARGIN } from "@/lib/programCost";
import { createAdminClient } from "@/lib/supabase-admin";
import { forecastRevenueCoins } from "@/lib/revenueForecast";

const QUEUE_LINKS = [
  // Коротко: на телефоне три плитки в ряд, «Заявки на выручку» обрезалось.
  { key: "revenue", label: "Выручка", href: "/admin/revenue-requests" },
  { key: "bonus", label: "Бонусы", href: "/admin/bonus-requests" },
  { key: "purchases", label: "Покупки", href: "/admin/purchase-requests" },
];

export default async function AdminOverview({ searchParams }) {
  const supabase = createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  const months = recentMonthKeysAlmaty(12);
  const selectedMonth = months.some((m) => m.key === searchParams?.month)
    ? searchParams.month
    : currentMonthKeyAlmaty();
  const { start, end } = monthRangeAlmaty(selectedMonth);

  const [
    { data: users },
    { count: pendingRevenue },
    { count: pendingBonus },
    { count: pendingPurchases },
    { data: nextRevenue },
    { data: nextBonus },
    { data: nextPurchase },
    { data: totalSpentRpc },
    { data: topups },
    { data: budgetExpenses },
    { data: funds },
    { data: fundTotalsRows },
    { data: roleRows },
  ] = await Promise.all([
    supabase
      .from("users")
      .select("*")
      .eq("role", "mop")
      .eq("is_active", true)
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local")
      .order("balance", { ascending: false }),
    supabase
      .from("revenue_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("bonus_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("purchase_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    // Первые (самые старые) заявки каждого типа — чтобы собрать общую
    // очередь и показать самую старую целиком, без похода на подстраницу.
    supabase
      .from("revenue_requests")
      .select("id, user_id, created_at, earned_at, amount_kzt, calculated_coins, comment, users!revenue_requests_user_id_fkey(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("bonus_requests")
      .select("id, created_at, category, amount_coins, comment, users!bonus_requests_user_id_fkey(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("purchase_requests")
      .select("id, created_at, price_coins, variant_label, comment, users!purchase_requests_user_id_fkey(name), rewards(title)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1),
    // "Реально потратили" — все покупки в магазине за месяц, кроме
    // отклонённых (те возвращаются пользователю и деньгами не считаются).
    // Агрегат в БД — не тянем все строки purchase_requests в JS.
    supabase.rpc("purchases_spent_total", { p_start: start, p_end: end }),
    supabase.from("budget_topups").select("amount_kzt"),
    supabase
      .from("purchase_requests")
      .select("actual_kzt_amount")
      .not("actual_kzt_amount", "is", null),
    supabase
      .from("funds")
      .select("id, title, status")
      .order("created_at", { ascending: false }),
    supabase.rpc("fund_totals"),
    // Какие роли вообще есть у живых людей — из них собираем кнопки
    // просмотра. Заведём завтра новую роль — кнопка появится сама.
    supabase
      .from("users")
      .select("role")
      .eq("is_active", true)
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local"),
  ]);

  const viewRoles = [...new Set((roleRows ?? []).map((r) => r.role))].filter(
    isViewableRole
  );
  const viewingAs = viewAsRole();

  const { data: myProfile } = me
    ? await supabase.from("users").select("theme").eq("id", me.id).single()
    : { data: null };
  const myTheme = themeOrDefault(myProfile?.theme);

  const totalBalance = users?.reduce((sum, u) => sum + u.balance, 0) ?? 0;

  const fundTotals = {};
  (fundTotalsRows ?? []).forEach((row) => {
    fundTotals[row.fund_id] = row.total;
  });

  // Коины, лежащие в активных копилках, тоже в обороте — это те же деньги,
  // просто отложенные. Закрытые копилки уже потрачены/возвращены.
  const activeFundIds = new Set(
    (funds ?? []).filter((f) => f.status === "active").map((f) => f.id)
  );
  const coinsInFunds = (funds ?? [])
    .filter((f) => activeFundIds.has(f.id))
    .reduce((sum, f) => sum + (fundTotals[f.id] ?? 0), 0);
  const coinsInCirculation = totalBalance + coinsInFunds;

  const totalSpent = typeof totalSpentRpc === "number" ? totalSpentRpc : 0;

  const remainingBudget =
    (topups?.reduce((sum, t) => sum + t.amount_kzt, 0) ?? 0) -
    (budgetExpenses?.reduce((sum, e) => sum + e.actual_kzt_amount, 0) ?? 0);

  const [earnedMap, cost, nextForecast] = await Promise.all([
    getEarnedMap(supabase, (users ?? []).map((u) => u.id), { start, end }),
    getProgramCost(createAdminClient(), { start, end }),
    forecastRevenueCoins(createAdminClient(), nextRevenue ?? []),
  ]);

  // Общая очередь: берём самую старую заявку среди трёх типов.
  const candidates = [
    nextRevenue?.[0] && {
      type: "revenue",
      id: nextRevenue[0].id,
      created_at: nextRevenue[0].created_at,
      name: nextRevenue[0].users?.name,
      title: `${nextRevenue[0].amount_kzt.toLocaleString("ru-RU")} ₸`,
      sub: `→ ${formatCoins(nextForecast[nextRevenue[0].id] ?? nextRevenue[0].calculated_coins ?? 0)}`,
      comment: nextRevenue[0].comment,
    },
    nextBonus?.[0] && {
      type: "bonus",
      id: nextBonus[0].id,
      created_at: nextBonus[0].created_at,
      name: nextBonus[0].users?.name,
      title: BONUS_CATEGORIES[nextBonus[0].category]?.label ?? nextBonus[0].category,
      sub: nextBonus[0].amount_coins ? `${formatCoins(nextBonus[0].amount_coins)}` : null,
      comment: nextBonus[0].comment,
    },
    nextPurchase?.[0] && {
      type: "purchase",
      id: nextPurchase[0].id,
      created_at: nextPurchase[0].created_at,
      name: nextPurchase[0].users?.name,
      title: nextPurchase[0].rewards?.title ?? "награда",
      sub: `${formatCoins(nextPurchase[0].price_coins)}${
        nextPurchase[0].variant_label ? ` — ${nextPurchase[0].variant_label}` : ""
      }`,
      comment: nextPurchase[0].comment,
    },
  ].filter(Boolean);

  candidates.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const nextItem = candidates[0] ?? null;

  const totalPending = (pendingRevenue ?? 0) + (pendingBonus ?? 0) + (pendingPurchases ?? 0);
  const pendingByKey = {
    revenue: pendingRevenue ?? 0,
    bonus: pendingBonus ?? 0,
    purchases: pendingPurchases ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-gray-500 text-sm">Ждёт вас</p>
          <h1 className="text-3xl font-black tabular-nums">{totalPending}</h1>
        </div>
        <div>
          <p className="text-[11px] text-gray-500 mb-1.5">
            Посмотреть кабинет глазами
          </p>
          <ViewAsSwitch roles={viewRoles} current={viewingAs} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {QUEUE_LINKS.map((q) => (
              <Link
                key={q.key}
                href={q.href}
                className="bg-dark-800 border border-dark-600 rounded-xl p-3 active:scale-[0.98] transition"
              >
                <p className="text-[11px] text-gray-500 truncate">
                  {q.label}
                </p>
                <p
                  className={`text-2xl font-bold tabular-nums mt-0.5 ${
                    pendingByKey[q.key] > 0 ? "text-amber-400" : "text-gray-300"
                  }`}
                >
                  {pendingByKey[q.key]}
                </p>
              </Link>
            ))}
          </div>

          <AdminQueueNext item={nextItem} />

          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">Потрачено в магазине</p>
              <MonthPicker months={months} selected={selectedMonth} />
            </div>
            <p className="text-2xl font-bold text-acid-400 tabular-nums">
              {totalSpent.toLocaleString("ru-RU")}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Сумма покупок наград за месяц, без отклонённых (за них деньги
              вернулись)
            </p>
          </div>

          <ProgramCostCard cost={cost} />

          <ThemePicker current={myTheme} />

          {funds && funds.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Копилки — сколько закинули</p>
              {funds.map((f) => (
                <div
                  key={f.id}
                  className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between"
                >
                  <p className="font-semibold truncate">{f.title}</p>
                  <p className="font-bold text-acid-400 shrink-0 tabular-nums">
                    {(fundTotals[f.id] ?? 0).toLocaleString("ru-RU")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Link
            href="/admin/budget"
            className="block rounded-2xl p-5 border border-acid-400/20 bg-gradient-to-br from-acid-400/10 via-dark-800 to-dark-800"
          >
            <p className="text-gray-400 text-xs">
              Остаток бюджета на закуп
            </p>
            <p
              className={`mt-1 text-3xl font-black tabular-nums ${
                remainingBudget < 0 ? "text-red-400" : "text-acid-400"
              }`}
            >
              {remainingBudget.toLocaleString("ru-RU")} ₸
            </p>
          </Link>

          <div className="bg-dark-800 border border-white/5 rounded-2xl p-4">
            <p className="text-[11px] text-gray-400">
              Коинов на руках
            </p>
            <p className="text-2xl font-bold tabular-nums mt-0.5 text-acid-400">
              {coinsInCirculation.toLocaleString("ru-RU")}
            </p>
            {coinsInFunds > 0 && (
              <p className="text-[11px] text-gray-500 mt-0.5">
                в копилках: {coinsInFunds.toLocaleString("ru-RU")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-gray-500 flex items-center gap-1.5">
              <Icon name="chart" className="w-4 h-4" />
              Кто сдаёт — баланс сейчас
            </p>
            {users?.map((u, i) => (
              <div
                key={u.id}
                className="bg-dark-800 border border-dark-600 rounded-xl p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-gray-500 w-4 text-xs shrink-0">{i + 1}</span>
                  <p className="font-semibold text-sm truncate">{u.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-acid-400 tabular-nums text-sm">
                    {u.balance.toLocaleString("ru-RU")}
                  </p>
                  <p className="text-[11px] text-gray-500 tabular-nums">
                    за месяц {(earnedMap[u.id] ?? 0).toLocaleString("ru-RU")}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <ResetButton />
        </div>
      </div>
    </div>
  );
}

// Сколько программа стоит компании за месяц — по выданным коинам. Цвет:
// в рамках (до 7% прибыли), на грани (7–10%), перебор (больше 10%).
function ProgramCostCard({ cost }) {
  const pct = cost.share == null ? null : cost.share * 100;
  const tone =
    pct == null
      ? "text-gray-300"
      : cost.share <= BUDGET_SHARE.ok
      ? "text-acid-400"
      : cost.share <= BUDGET_SHARE.max
      ? "text-amber-400"
      : "text-red-400";
  const verdict =
    pct == null
      ? "Выручки за месяц пока нет"
      : cost.share <= BUDGET_SHARE.ok
      ? "В рамках бюджета"
      : cost.share <= BUDGET_SHARE.max
      ? "На верхней границе бюджета"
      : "Дороже бюджета — пора пересмотреть ставки";
  const kzt = (n) => `${Math.round(n).toLocaleString("ru-RU")} ₸`;

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
      <p className="text-xs text-gray-500">Сколько стоит PactoCoins за месяц</p>
      <div className="mt-1 flex items-baseline gap-3 flex-wrap">
        <span className={`text-2xl font-bold tabular-nums ${tone}`}>
          {pct == null ? "—" : `${pct.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`}
        </span>
        <span className="text-sm text-gray-400">прибыли · {kzt(cost.costKzt)}</span>
      </div>
      <p className={`text-xs mt-1 ${tone}`}>{verdict}</p>

      <div className="mt-3 space-y-1 text-xs">
        {cost.breakdown.map((b) => (
          <div key={b.label} className="flex justify-between gap-3 text-gray-400">
            <span>{b.label}</span>
            <span className="tabular-nums">
              {formatCoins(b.coins)} · {kzt(b.kzt)}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-600 mt-3 leading-relaxed">
        Считаем по выданным коинам (их всё равно потратят), без возвратов и без
        админов. 1 коин ≈ {cost.kztPerCoin.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₸
        — по реальным покупкам за 90 дней. Прибыль ≈ {(NET_MARGIN * 100).toLocaleString("ru-RU")}% от
        выручки {kzt(cost.revenueKzt)} = {kzt(cost.profitKzt)}. Бюджет — 5–10% прибыли.
      </p>
    </div>
  );
}
