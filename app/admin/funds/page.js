import { createClient } from "@/lib/supabase-server";
import AdminFundsClient from "@/components/AdminFundsClient";

export default async function AdminFundsPage() {
  const supabase = createClient();

  const { data: funds } = await supabase
    .from("funds")
    .select("*")
    .order("created_at", { ascending: false });

  const fundIds = (funds ?? []).map((f) => f.id);

  const { data: contributions } = fundIds.length
    ? await supabase
        .from("fund_contributions")
        .select("fund_id, amount_coins")
        .in("fund_id", fundIds)
    : { data: [] };

  const totals = {};
  (contributions ?? []).forEach((c) => {
    totals[c.fund_id] = (totals[c.fund_id] ?? 0) + c.amount_coins;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Копилки</h1>
      <AdminFundsClient funds={funds ?? []} totals={totals} />
    </div>
  );
}
