import BroadcastClient from "@/components/BroadcastClient";
import { createClient } from "@/lib/supabase-server";

export default async function BroadcastPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: employees } = await supabase
    .from("users")
    .select("id, name")
    .not("telegram_id", "is", null)
    .neq("id", user.id)
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Рассылка</h1>
      <BroadcastClient employees={employees ?? []} />
    </div>
  );
}
