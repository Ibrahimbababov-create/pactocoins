import { createClient } from "@/lib/supabase-server";

export default async function AdminOverview() {
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Обзор</h1>

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
    </div>
  );
}
