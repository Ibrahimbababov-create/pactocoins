import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import ResetButton from "@/components/ResetButton";
import MonthPicker from "@/components/MonthPicker";
import AdminQueueNext from "@/components/AdminQueueNext";
import Icon from "@/components/Icon";
import {
  monthRangeAlmaty,
  currentMonthKeyAlmaty,
  recentMonthKeysAlmaty,
} from "@/lib/timezone";
import { getEarnedMap } from "@/lib/earnings";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";

const QUEUE_LINKS = [
  { key: "revenue", label: "Заявки на выручку", href: "/admin/revenue-requests" },
  { key: "bonus", label: "Заявки на бонусы", href: "/admin/bonus-requests" },
  { key: "purchases", label: "Заявки на покупки", href: "/admin/purchase-requests" },
];

export default async function AdminOverview({ searchParams }) {
  const supabase = createClient();

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
      .select("id, created_at, amount_kzt, calculated_coins, comment, users(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("bonus_requests")
      .select("id, created_at, category, amount_coins, comment, users(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("purchase_requests")
      .select("id, created_at, price_coins, variant_label, comment, users(name), rewards(title)")
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
  ]);

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

  const earnedMap = await getEarnedMap(supabase, (users ?? []).map((u) => u.id), {
    start,
    end,
  });

  // Общая очередь: берём самую старую заявку среди трёх типов.
  const candidates = [
    nextRevenue?.[0] && {
      type: "revenue",
      id: nextRevenue[0].id,
      created_at: nextRevenue[0].created_at,
      name: nextRevenue[0].users?.name,
      title: `${nextRevenue[0].amount_kzt.toLocaleString("ru-RU")} ₸`,
      sub: `→ ${nextRevenue[0].calculated_coins ?? "?"} коинов`,
      comment: nextRevenue[0].comment,
    },
    nextBonus?.[0] && {
      type: "bonus",
      id: nextBonus[0].id,
      created_at: nextBonus[0].created_at,
      name: nextBonus[0].users?.name,
      title: BONUS_CATEGORIES[nextBonus[0].category]?.label ?? nextBonus[0].category,
      sub: nextBonus[0].amount_coins ? `${nextBonus[0].amount_coins} коинов` : null,
      comment: nextBonus[0].comment,
    },
    nextPurchase?.[0] && {
      type: "purchase",
      id: nextPurchase[0].id,
      created_at: nextPurchase[0].created_at,
      name: nextPurchase[0].users?.name,
      title: nextPurchase[0].rewards?.title ?? "награда",
      sub: `${nextPurchase[0].price_coins.toLocaleString("ru-RU")} коинов${
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
        <div className="flex flex-wrap gap-2">
          <Link href="/mop" className="bg-acid-400 text-black font-bold rounded-lg px-3 py-2 text-xs">
            МОП
          </Link>
          <Link href="/mop/team" className="bg-dark-700 text-gray-200 font-bold rounded-lg px-3 py-2 text-xs">
            РОП
          </Link>
          <Link href="/observer" className="bg-dark-700 text-gray-200 font-bold rounded-lg px-3 py-2 text-xs">
            Наблюдатель
          </Link>
          <Link href="/mop?as=trainee" className="bg-dark-700 text-gray-200 font-bold rounded-lg px-3 py-2 text-xs">
            Стажёр
          </Link>
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
                <p className="text-[11px] text-gray-500 uppercase tracking-wider truncate">
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
            className="block rounded-2xl p-5 border border-acid-400/20 bg-gradient-to-br from-[#18220b] via-dark-800 to-dark-800"
          >
            <p className="text-gray-400 text-xs uppercase tracking-widest">
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
            <p className="text-[11px] text-gray-400 uppercase tracking-wider">
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
