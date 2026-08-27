import { createClient } from "@/lib/supabase-server";

export default async function ObserverOverview() {
  const supabase = createClient();

  const [{ data: users }, { count: pendingRevenue }, { count: pendingBonus }, { count: pendingPurchases }] =
    await Promise.all([
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
    ]);

  const totalBalance = users?.reduce((sum, u) => sum + u.balance, 0) ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Обзор</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Всего МОПов", value: users?.length ?? 0, tone: "" },
          {
            label: "Коинов в обороте",
            value: totalBalance,
            tone: "text-acid-400",
          },
          {
            label: "Заявки на выручку",
            value: pendingRevenue ?? 0,
            tone: (pendingRevenue ?? 0) > 0 ? "text-yellow-400" : "text-gray-300",
          },
          {
            label: "Заявки на бонусы",
            value: pendingBonus ?? 0,
            tone: (pendingBonus ?? 0) > 0 ? "text-yellow-400" : "text-gray-300",
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
          </div>
        ))}
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
              <p className="font-bold text-acid-400 tabular-nums">
                {u.balance.toLocaleString("ru-RU")}
              </p>
              <p className="text-xs text-gray-500 tabular-nums">
                всего {u.total_earned.toLocaleString("ru-RU")} · месяц{" "}
                {u.month_earned.toLocaleString("ru-RU")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
