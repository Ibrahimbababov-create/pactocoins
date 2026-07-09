import { createClient } from "@/lib/supabase-server";
import RewardsAdminClient from "@/components/RewardsAdminClient";

export default async function RewardsAdminPage() {
  const supabase = createClient();

  const { data: rewards } = await supabase
    .from("rewards")
    .select("*")
    .order("category")
    .order("price_coins");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Магазин наград</h1>
      <RewardsAdminClient rewards={rewards ?? []} />
    </div>
  );
}
