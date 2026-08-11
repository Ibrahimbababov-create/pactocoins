import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import ResetButton from "@/components/ResetButton";
import MonthPicker from "@/components/MonthPicker";
import {
  monthRangeAlmaty,
  currentMonthKeyAlmaty,
  recentMonthKeysAlmaty,
} from "@/lib/timezone";

export default async function AdminOverview({ searchParams }) {
  const supabase = createClient();

  const { data: users } = await supabase
    .from("users")
    .select("*")
    .eq("role", "mop")
    .order("balance", { ascending: false });

  const { count: pendingRevenue } = await supabase
    .from("revenue_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: pendingPurchases } = await supabase
    .from("purchase_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const totalBalance = users?.reduce((sum, u) => sum + u.balance, 0) ?? 0;

  const months = recentMonthKeysAlmaty(12);
  const selectedMonth = months.some((m) => m.key === searchParams?.month)
    ? searchParams.month
    : currentMonthKeyAlmaty();
  const { start, end } = monthRangeAlmaty(selectedMonth);

  // "Реально потратили" — все покупки в магазине за месяц, кроме отклонённых
  // (те возвращаются пользователю и деньгами не считаются).
  const { data: spentPurchases } = await supabase
    .from("purchase_requests")
    .select("price_coins")
    .neq("status", "rejected")
    .gte("created_at", start)
    .lt("created_at", end);

  const totalSpent =
    spentPurchases?.reduce((sum, p) => sum + p.price_coins, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Обзор</h1>
        <Link
          href="/mop"
          className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm"
        >
          👁 Открыть как МОП
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Всего МОПов</p>
          <p className="text-2xl font-bold">{users?.length ?? 0}</p>
        </div>
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Коинов в обороте</p>
          <p className="text-2xl font-bold text-acid-400">{totalBalance}</p>
        </div>
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Заявки на выручку</p>
          <p className="text-2xl font-bold text-yellow-400">
            {pendingRevenue ?? 0}
          </p>
        </div>
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Заявки на покупки</p>
          <p className="text-2xl font-bold text-yellow-400">
            {pendingPurchases ?? 0}
          </p>
        </div>
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
              <p className="font-bold text-acid-400">{u.balance}</p>
              <p className="text-xs text-gray-500">
                всего {u.total_earned} · месяц {u.month_earned}
              </p>
            </div>
          </div>
        ))}
      </div>

      <ResetButton />
    </div>
  );
}
