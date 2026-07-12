import { createClient } from "@/lib/supabase-server";
import RevenueRequestForm from "@/components/RevenueRequestForm";
import BonusRequestForm from "@/components/BonusRequestForm";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";

export default async function MopDashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: pendingRevenue }, { data: pendingBonus }] =
    await Promise.all([
      supabase.from("users").select("*").eq("id", user.id).single(),
      supabase
        .from("revenue_requests")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("bonus_requests")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

  const hasPending =
    (pendingRevenue?.length ?? 0) > 0 || (pendingBonus?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-gray-500 text-sm">Привет, {profile?.name}</p>
        <h1 className="text-2xl font-bold">PactoCoins</h1>
      </div>

      {/* Баланс — крупная цифра */}
      <div className="bg-gradient-to-br from-dark-800 to-dark-700 border border-dark-600 rounded-3xl p-6">
        <p className="text-gray-500 text-sm mb-1">Текущий баланс</p>
        <p className="text-6xl font-black text-acid-400 tracking-tight">
          {profile?.balance ?? 0}
        </p>
        <p className="text-gray-500 text-sm mt-1">coins</p>

        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-dark-600">
          <div>
            <p className="text-gray-500 text-xs">Всего заработано</p>
            <p className="text-xl font-bold">{profile?.total_earned ?? 0}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">За этот месяц</p>
            <p className="text-xl font-bold">{profile?.month_earned ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Заявка на выручку */}
      <RevenueRequestForm />

      {/* Заявка на бонус */}
      <BonusRequestForm />

      {/* Заявки в ожидании */}
      {hasPending && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Ожидают подтверждения</p>

          {pendingRevenue?.map((r) => (
            <div
              key={r.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold">
                  {r.amount_kzt.toLocaleString("ru-RU")} ₸
                </p>
                <p className="text-xs text-gray-500">{r.comment}</p>
              </div>
              <span className="text-xs bg-yellow-500/10 text-yellow-400 px-3 py-1 rounded-full">
                Ожидает
              </span>
            </div>
          ))}

          {pendingBonus?.map((r) => (
            <div
              key={r.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold">
                  {BONUS_CATEGORIES[r.category]?.label ?? r.category}
                </p>
                <p className="text-xs text-gray-500">
                  {r.amount_coins} coins
                  {r.comment ? ` · ${r.comment}` : ""}
                </p>
              </div>
              <span className="text-xs bg-yellow-500/10 text-yellow-400 px-3 py-1 rounded-full">
                Ожидает
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
