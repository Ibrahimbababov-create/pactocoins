import { createClient } from "@/lib/supabase-server";
import BonusRequestsClient from "@/components/BonusRequestsClient";
import { lastWeekRangeAlmaty } from "@/lib/timezone";

export default async function BonusRequestsPage() {
  const supabase = createClient();
  const week = lastWeekRangeAlmaty();

  const { data: requests } = await supabase
    .from("bonus_requests")
    .select("*, users!bonus_requests_user_id_fkey(name, email, is_guest)")
    .order("created_at", { ascending: false });

  const { data: employees } = await supabase
    .from("users")
    .select("id, name")
    .in("role", ["mop", "rop"])
    .eq("is_active", true)
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local")
    .order("name");

  // Рейтинг за прошлую неделю (реальный заработок, как в общем рейтинге).
  const empIds = (employees ?? []).map((e) => e.id);
  let weekRanking = [];
  if (empIds.length) {
    const { data: tx } = await supabase
      .from("transactions")
      .select("user_id, amount_coins")
      .in("user_id", empIds)
      .eq("rating_exempt", false)
      .gt("amount_coins", 0)
      .gte("created_at", week.start)
      .lt("created_at", week.end);

    const totals = {};
    for (const t of tx ?? []) {
      totals[t.user_id] = (totals[t.user_id] ?? 0) + t.amount_coins;
    }
    const nameById = Object.fromEntries(
      (employees ?? []).map((e) => [e.id, e.name])
    );
    weekRanking = Object.entries(totals)
      .map(([id, total]) => ({ id, name: nameById[id] ?? "—", total }))
      .sort((a, b) => b.total - a.total);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Бонусы</h1>
      <BonusRequestsClient
        requests={requests ?? []}
        employees={employees ?? []}
        weekRanking={weekRanking}
        weekLabel={week.label}
      />
    </div>
  );
}
