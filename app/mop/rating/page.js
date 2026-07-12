import { createClient } from "@/lib/supabase-server";
import RatingClient from "@/components/RatingClient";

export default async function RatingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: users } = await supabase
    .from("users")
    .select("id, name, total_earned")
    .eq("role", "mop");

  const userIds = users?.map((u) => u.id) ?? [];

  const { data: transactions } = await supabase
    .from("transactions")
    .select("user_id, amount_coins, description, type")
    .in("user_id", userIds);

  const revenueTotals = {};
  const bonusTotals = {};

  transactions?.forEach((t) => {
    const desc = t.description || "";
    if (desc.startsWith("Выручка подтверждена")) {
      revenueTotals[t.user_id] = (revenueTotals[t.user_id] || 0) + t.amount_coins;
    } else if (desc.startsWith("Бонус:") || desc.startsWith("ТОП-")) {
      bonusTotals[t.user_id] = (bonusTotals[t.user_id] || 0) + t.amount_coins;
    }
  });

  function buildRanking(getValue) {
    return (users ?? [])
      .map((u) => ({ id: u.id, name: u.name, value: getValue(u) }))
      .sort((a, b) => b.value - a.value);
  }

  const overall = buildRanking((u) => u.total_earned);
  const revenue = buildRanking((u) => revenueTotals[u.id] || 0);
  const bonus = buildRanking((u) => bonusTotals[u.id] || 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Рейтинг</h1>
      <RatingClient
        currentUserId={user.id}
        overall={overall}
        revenue={revenue}
        bonus={bonus}
      />
    </div>
  );
}
