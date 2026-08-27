import { createClient } from "@/lib/supabase-server";
import { recentDaysAlmaty, almatyDayKey } from "@/lib/timezone";

const DAYS = 10;

export default async function MyStatsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const days = recentDaysAlmaty(DAYS);
  const startIso = new Date(`${days[0].key}T00:00:00+05:00`).toISOString();

  const [{ data: inflows }, { data: purchases }] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount_coins, created_at")
      .eq("user_id", user.id)
      .gt("amount_coins", 0)
      .gte("created_at", startIso),
    supabase
      .from("purchase_requests")
      .select("status, rewards(category)")
      .eq("user_id", user.id)
      .neq("status", "rejected"),
  ]);

  // Раскладка заработка по дням
  const byDay = Object.fromEntries(days.map((d) => [d.key, 0]));
  for (const t of inflows ?? []) {
    const k = almatyDayKey(t.created_at);
    if (k in byDay) byDay[k] += t.amount_coins;
  }
  const series = days.map((d) => ({ ...d, value: byDay[d.key] }));
  const values = series.map((s) => s.value);
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(...values, 1);
  const activeDays = values.filter((v) => v > 0).length;
  const bestValue = Math.max(...values, 0);

  // Любимая категория покупок (за всё время)
  const catCount = {};
  for (const p of purchases ?? []) {
    const cat = p.rewards?.category;
    if (cat) catCount[cat] = (catCount[cat] ?? 0) + 1;
  }
  const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
  const totalPurchases = (purchases ?? []).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📊 Моя динамика</h1>
        <p className="text-gray-500 text-sm mt-1">
          Заработок за последние {DAYS} дней
        </p>
      </div>

      {/* Столбики по дням */}
      <div className="bg-gradient-to-br from-dark-800 to-dark-700 border border-dark-600 rounded-2xl p-4">
        {total === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            За этот период начислений не было
          </p>
        ) : (
          <div className="flex justify-between gap-1.5">
            {series.map((s) => {
              const h = s.value > 0 ? Math.max(6, (s.value / max) * 100) : 0;
              const isBest = s.value > 0 && s.value === bestValue;
              return (
                <div
                  key={s.key}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <span
                    className={`text-[10px] font-semibold ${
                      s.value > 0 ? "text-gray-300" : "text-transparent"
                    }`}
                  >
                    {s.value > 0 ? s.value : "0"}
                  </span>
                  <div className="w-full h-28 flex items-end">
                    <div
                      className={`w-full rounded-t ${
                        isBest ? "bg-acid-400" : "bg-acid-400/40"
                      }`}
                      style={{ height: `${h}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 leading-tight text-center">
                    {s.label}
                    <br />
                    {s.weekday}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3">
          <p className="text-gray-500 text-xs">Всего за {DAYS} дней</p>
          <p className="text-xl font-bold text-acid-400">{total}</p>
        </div>
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3">
          <p className="text-gray-500 text-xs">Лучший день</p>
          <p className="text-xl font-bold">{bestValue}</p>
        </div>
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3">
          <p className="text-gray-500 text-xs">Дней с начислением</p>
          <p className="text-xl font-bold">
            {activeDays}
            <span className="text-gray-500 text-sm">/{DAYS}</span>
          </p>
        </div>
      </div>

      {/* Любимая категория */}
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
        <p className="text-sm text-gray-500 mb-1">Любимая категория покупок</p>
        {topCat ? (
          <p className="font-bold">
            🛍 {topCat[0]}{" "}
            <span className="text-gray-500 font-normal text-sm">
              · {topCat[1]} из {totalPurchases}
            </span>
          </p>
        ) : (
          <p className="text-sm text-gray-500">Пока ничего не покупал</p>
        )}
      </div>
    </div>
  );
}
