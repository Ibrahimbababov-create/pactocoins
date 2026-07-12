import { createClient } from "@/lib/supabase-server";

const typeLabels = {
  earn: { label: "Начисление", color: "text-acid-400" },
  manual_add: { label: "Бонус/начисление", color: "text-acid-400" },
  spend: { label: "Покупка", color: "text-red-400" },
  manual_subtract: { label: "Списание", color: "text-red-400" },
};

export default async function ObserverActivity() {
  const supabase = createClient();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*, users(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Активность</h1>
      <p className="text-sm text-gray-500">
        Последние 200 операций всех сотрудников
      </p>

      <div className="space-y-2">
        {transactions?.length === 0 && (
          <p className="text-gray-600 text-sm">Пока пусто</p>
        )}
        {transactions?.map((t) => {
          const meta = typeLabels[t.type] ?? {
            label: t.type,
            color: "text-white",
          };
          const isNegative = t.amount_coins < 0;

          return (
            <div
              key={t.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold">
                  {t.users?.name} · {meta.label}
                </p>
                {t.description && (
                  <p className="text-xs text-gray-500">{t.description}</p>
                )}
                <p className="text-xs text-gray-600">
                  {new Date(t.created_at).toLocaleString("ru-RU")}
                </p>
              </div>
              <span className={`font-bold ${meta.color}`}>
                {isNegative ? "" : "+"}
                {t.amount_coins}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
