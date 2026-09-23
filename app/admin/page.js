import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import ResetButton from "@/components/ResetButton";
import MonthPicker from "@/components/MonthPicker";
import {
  monthRangeAlmaty,
  currentMonthKeyAlmaty,
  recentMonthKeysAlmaty,
} from "@/lib/timezone";
import { getEarnedMap } from "@/lib/earnings";

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
    { count: pendingPurchases },
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
      .from("purchase_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Обзор</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/mop"
            className="bg-acid-400 text-black font-bold rounded-lg px-3 py-2 text-xs"
          >
            👁 МОП
          </Link>
          <Link
            href="/mop/team"
            className="bg-dark-700 text-gray-200 font-bold rounded-lg px-3 py-2 text-xs"
          >
            👁 РОП
          </Link>
          <Link
            href="/observer"
            className="bg-dark-700 text-gray-200 font-bold rounded-lg px-3 py-2 text-xs"
          >
            👁 Наблюдатель
          </Link>
          <Link
            href="/mop?as=trainee"
            className="bg-dark-700 text-gray-200 font-bold rounded-lg px-3 py-2 text-xs"
          >
            👁 Стажёр
          </Link>
        </div>
      </div>

      <Link
        href="/admin/budget"
        className="block rounded-2xl p-6 border border-dark-600 bg-dark-800"
      >
        <p className="text-gray-400 text-xs uppercase tracking-widest">
          Остаток бюджета на закуп
        </p>
        <p
          className={`mt-1 text-4xl font-black tabular-nums ${
            remainingBudget < 0 ? "text-red-400" : "text-acid-400"
          }`}
        >
          {remainingBudget.toLocaleString("ru-RU")} ₸
        </p>
      </Link>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Всего МОПов", value: users?.length ?? 0, tone: "" },
          {
            label: "Коинов в обороте",
            value: coinsInCirculation,
            tone: "text-acid-400",
            hint:
              coinsInFunds > 0
                ? `в копилках: ${coinsInFunds.toLocaleString("ru-RU")}`
                : null,
          },
          {
            label: "Заявки на выручку",
            value: pendingRevenue ?? 0,
            tone: (pendingRevenue ?? 0) > 0 ? "text-yellow-400" : "text-gray-300",
          },
          {
            label: "Заявки на покупки",
            value: pendingPurchases ?? 0,
            tone:
              (pendingPurchases ?? 0) > 0 ? "text-yellow-400" : "text-gray-300",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-dark-800 border border-white/5 rounded-2xl p-4"
          >
            <p className="text-[11px] text-gray-400 uppercase tracking-wider">
              {s.label}
            </p>
            <p className={`text-2xl font-bold tabular-nums mt-0.5 ${s.tone}`}>
              {s.value.toLocaleString("ru-RU")}
            </p>
            {s.hint && (
              <p className="text-[11px] text-gray-500 mt-0.5">{s.hint}</p>
            )}
          </div>
        ))}
      </div>

      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500">Потрачено в магазине</p>
          <MonthPicker months={months} selected={selectedMonth} />
        </div>
        <p className="text-2xl font-bold text-acid-400">
          {totalSpent.toLocaleString("ru-RU")} coins
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
              <p className="font-bold text-acid-400 shrink-0">
                {(fundTotals[f.id] ?? 0).toLocaleString("ru-RU")} coins
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-gray-500">Рейтинг по балансу</p>
        {users?.map((u, i) => (
          <div
            key={u.id}
            className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-500 w-5">{i + 1}</span>
              <div>
                <p className="font-semibold">{u.name}</p>
                <p className="text-xs text-gray-500">{u.email}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-acid-400 tabular-nums">
                {u.balance.toLocaleString("ru-RU")}
              </p>
              <p className="text-xs text-gray-500 tabular-nums">
                всего {u.total_earned.toLocaleString("ru-RU")} · за месяц{" "}
                {(earnedMap[u.id] ?? 0).toLocaleString("ru-RU")}
              </p>
            </div>
          </div>
        ))}
      </div>

      <ResetButton />
    </div>
  );
}
