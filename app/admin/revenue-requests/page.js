import { createClient } from "@/lib/supabase-server";
import RevenueRequestsClient from "@/components/RevenueRequestsClient";

export default async function RevenueRequestsPage() {
  const supabase = createClient();

  const { data: requests } = await supabase
    .from("revenue_requests")
    .select("*, users!revenue_requests_user_id_fkey(name, email)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Заявки на выручку</h1>
      <RevenueRequestsClient requests={requests ?? []} />
    </div>
  );
}
