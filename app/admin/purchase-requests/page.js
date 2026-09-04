import { createClient } from "@/lib/supabase-server";
import PurchaseRequestsClient from "@/components/PurchaseRequestsClient";

export default async function PurchaseRequestsPage() {
  const supabase = createClient();

  const [{ data: purchases }, { data: topups }] = await Promise.all([
    supabase
      .from("purchase_requests")
      .select(
        "*, users!purchase_requests_user_id_fkey(name, email, role, is_guest), reviewer:users!purchase_requests_reviewed_by_fkey(name), rewards(title, category)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("budget_topups").select("amount_kzt"),
  ]);

  const totalTopups = (topups ?? []).reduce((sum, t) => sum + t.amount_kzt, 0);
  const totalSpent = (purchases ?? []).reduce(
    (sum, p) => sum + (p.actual_kzt_amount || 0),
    0
  );
  const remainingBudget = totalTopups - totalSpent;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Заявки на покупки</h1>
        <div className="bg-dark-800 border border-dark-600 rounded-xl px-4 py-2 text-right">
          <p className="text-xs text-gray-500">Остаток бюджета</p>
          <p
            className={`text-lg font-bold ${
              remainingBudget < 0 ? "text-red-400" : "text-acid-400"
            }`}
          >
            {remainingBudget.toLocaleString("ru-RU")} ₸
          </p>
        </div>
      </div>
      <PurchaseRequestsClient purchases={purchases ?? []} />
    </div>
  );
}
