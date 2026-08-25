import { createClient } from "@/lib/supabase-server";
import JoinRequestsClient from "@/components/JoinRequestsClient";

export default async function JoinRequestsPage() {
  const supabase = createClient();

  const { data: requests } = await supabase
    .from("join_requests")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Заявки на регистрацию</h1>
      <JoinRequestsClient requests={requests ?? []} />
    </div>
  );
}
