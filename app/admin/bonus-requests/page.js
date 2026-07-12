import { createClient } from "@/lib/supabase-server";
import BonusRequestsClient from "@/components/BonusRequestsClient";

export default async function BonusRequestsPage() {
  const supabase = createClient();

  const { data: requests } = await supabase
    .from("bonus_requests")
    .select("*, users(name, email)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Бонусы</h1>
      <BonusRequestsClient requests={requests ?? []} />
    </div>
  );
}
