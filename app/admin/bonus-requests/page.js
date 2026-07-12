import { createClient } from "@/lib/supabase-server";
import BonusRequestsClient from "@/components/BonusRequestsClient";

export default async function BonusRequestsPage() {
  const supabase = createClient();

  const { data: requests } = await supabase
    .from("bonus_requests")
    .select("*, users!bonus_requests_user_id_fkey(name, email)")
    .order("created_at", { ascending: false });

  const { data: employees } = await supabase
    .from("users")
    .select("id, name")
    .eq("role", "mop")
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Бонусы</h1>
      <BonusRequestsClient requests={requests ?? []} employees={employees ?? []} />
    </div>
  );
}
