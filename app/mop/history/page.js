import { createClient } from "@/lib/supabase-server";
import HistoryClient from "@/components/HistoryClient";

// Всю историю за всё время в HTML не тащим: у активного менеджера это
// сотни строк и сотни килобайт в Mini App.
const HISTORY_LIMIT = 300;

export default async function HistoryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: transactions },
    { data: purchases },
    { count: pendingRevenue },
    { count: pendingBonus },
    { count: pendingPurchases },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("purchase_requests")
      .select("*, rewards(title, category)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("revenue_requests")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending"),
    supabase
      .from("bonus_requests")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending"),
    supabase
      .from("purchase_requests")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending"),
  ]);

  const pendingCount =
    (pendingRevenue ?? 0) + (pendingBonus ?? 0) + (pendingPurchases ?? 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">История</h1>
      <HistoryClient
        transactions={transactions ?? []}
        purchases={purchases ?? []}
        pendingCount={pendingCount}
        truncated={
          (transactions?.length ?? 0) >= HISTORY_LIMIT ||
          (purchases?.length ?? 0) >= HISTORY_LIMIT
        }
        limit={HISTORY_LIMIT}
      />
    </div>
  );
}
