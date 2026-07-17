import { createClient } from "@/lib/supabase-server";

const statusLabels = {
  pending: { label: "Ожидает", color: "bg-yellow-500/10 text-yellow-400" },
  approved: { label: "Одобрено", color: "bg-blue-500/10 text-blue-400" },
  done: { label: "Выполнено", color: "bg-acid-400/10 text-acid-400" },
  rejected: { label: "Отклонено", color: "bg-red-500/10 text-red-400" },
};

export default async function PurchasesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: purchases } = await supabase
    .from("purchase_requests")
    .select("*, rewards(title, category)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Мои покупки</h1>

      <div className="space-y-2">
        {purchases?.length === 0 && (
          <p className="text-gray-500 text-sm">Покупок пока нет</p>
        )}

        {purchases?.map((p) => {
          const meta = statusLabels[p.status] ?? {
            label: p.status,
            color: "bg-gray-500/10 text-gray-400",
          };

          return (
            <div
              key={p.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold">{p.rewards?.title}</p>
                <p className="text-xs text-gray-500">
                  {p.price_coins} coins ·{" "}
                  {new Date(p.created_at).toLocaleString("ru-RU")}
                </p>
              </div>
              <span
                className={`text-xs px-3 py-1 rounded-full ${meta.color}`}
              >
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
