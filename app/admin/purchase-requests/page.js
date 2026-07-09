import { createClient } from "@/lib/supabase-server";
import PurchaseRequestsClient from "@/components/PurchaseRequestsClient";

export default async function PurchaseRequestsPage() {
  const supabase = createClient();

  const { data: purchases } = await supabase
    .from("purchase_requests")
    .select("*, users(name, email), rewards(title, category)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Заявки на покупки</h1>
      <PurchaseRequestsClient purchases={purchases ?? []} />
    </div>
  );
}
