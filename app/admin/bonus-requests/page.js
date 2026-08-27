import { createClient } from "@/lib/supabase-server";
import BonusRequestsClient from "@/components/BonusRequestsClient";
import { lastWeekRangeAlmaty, lastMonthRangeAlmaty } from "@/lib/timezone";

async function rankingFor(supabase, empIds, nameById, start, end) {
  if (!empIds.length) return [];
  const { data: tx } = await supabase
    .from("transactions")
    .select("user_id, amount_coins")
    .in("user_id", empIds)
    .eq("rating_exempt", false)
    .gt("amount_coins", 0)
    .gte("created_at", start)
    .lt("created_at", end);

  const totals = {};
  for (const t of tx ?? []) {
    totals[t.user_id] = (totals[t.user_id] ?? 0) + t.amount_coins;
  }
  return Object.entries(totals)
    .map(([id, total]) => ({ id, name: nameById[id] ?? "—", total }))
    .sort((a, b) => b.total - a.total);
}

export default async function BonusRequestsPage() {
  const supabase = createClient();
  const week = lastWeekRangeAlmaty();
  const month = lastMonthRangeAlmaty();

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

  const empIds = (employees ?? []).map((e) => e.id);
  const nameById = Object.fromEntries(
    (employees ?? []).map((e) => [e.id, e.name])
  );

  const [weekRanking, monthRanking] = await Promise.all([
    rankingFor(supabase, empIds, nameById, week.start, week.end),
    rankingFor(supabase, empIds, nameById, month.start, month.end),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Бонусы</h1>
      <BonusRequestsClient
        requests={requests ?? []}
        employees={employees ?? []}
        weekRanking={weekRanking}
        weekLabel={week.label}
        monthRanking={monthRanking}
        monthLabel={month.label}
      />
    </div>
  );
}
