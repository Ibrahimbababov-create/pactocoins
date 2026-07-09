import { createClient } from "@/lib/supabase-server";

const typeLabels = {
  earn: { label: "Начисление", color: "text-acid-400", sign: "+" },
  manual_add: { label: "Бонус от админа", color: "text-acid-400", sign: "+" },
  spend: { label: "Покупка награды", color: "text-red-400", sign: "" },
  manual_subtract: { label: "Списание", color: "text-red-400", sign: "" },
};

export default async function HistoryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">История операций</h1>

      <div className="space-y-2">
        {transactions?.length === 0 && (
          <p className="text-gray-500 text-sm">Операций пока нет</p>
        )}

        {transactions?.map((t) => {
          const meta = typeLabels[t.type] ?? {
            label: t.type,
            color: "text-white",
            sign: "",
          };
          const isNegative = t.amount_coins < 0;

          return (
            <div
              key={t.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold">{meta.label}</p>
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
