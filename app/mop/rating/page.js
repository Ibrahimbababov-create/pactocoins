import { createClient } from "@/lib/supabase-server";
import RatingClient from "@/components/RatingClient";

export default async function RatingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: users } = await supabase
    .from("users")
    .select("id, name")
    .eq("role", "mop");

  const userIds = users?.map((u) => u.id) ?? [];

  const { data: transactions } = await supabase
    .from("transactions")
    .select("user_id, amount_coins, description, type, created_at")
    .in("user_id", userIds);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Рейтинг</h1>
      <RatingClient
        currentUserId={user.id}
        users={users ?? []}
        transactions={transactions ?? []}
      />
    </div>
  );
}
