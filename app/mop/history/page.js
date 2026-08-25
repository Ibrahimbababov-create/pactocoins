import { createClient } from "@/lib/supabase-server";
import HistoryClient from "@/components/HistoryClient";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";

export default async function HistoryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: transactions },
    { data: revenueRequests },
    { data: bonusRequests },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("revenue_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bonus_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const requests = [
    ...(revenueRequests ?? []).map((r) => ({
      id: `rev-${r.id}`,
      status: r.status,
      created_at: r.created_at,
      comment: r.comment,
      label: `Выручка: ${r.amount_kzt.toLocaleString("ru-RU")} ₸ → ${
        r.calculated_coins
      } coins`,
    })),
    ...(bonusRequests ?? []).map((r) => ({
      id: `bonus-${r.id}`,
      status: r.status,
      created_at: r.created_at,
      comment: r.comment,
      label: `${BONUS_CATEGORIES[r.category]?.label ?? r.category} → ${
        r.amount_coins
      } coins`,
    })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">История</h1>
      <HistoryClient transactions={transactions ?? []} requests={requests} />
    </div>
  );
}
