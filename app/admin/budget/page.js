import { createClient } from "@/lib/supabase-server";
import BudgetClient from "@/components/BudgetClient";

export default async function BudgetPage() {
  const supabase = createClient();

  const { data: topups } = await supabase
    .from("budget_topups")
    .select("*")
    .order("given_at", { ascending: false });

  const { data: expenses } = await supabase
    .from("purchase_requests")
    .select("*, users(name), rewards(title)")
    .not("actual_kzt_amount", "is", null)
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Бюджет на закуп</h1>
      <BudgetClient topups={topups ?? []} expenses={expenses ?? []} />
    </div>
  );
}
