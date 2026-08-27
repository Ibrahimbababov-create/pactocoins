import { createClient } from "@/lib/supabase-server";
import RatingClient from "@/components/RatingClient";

export default async function AdminRating() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: users } = await supabase
    .from("users")
    .select("id, name, total_earned")
    .eq("role", "mop")
    .eq("is_active", true)
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local");

  const userIds = users?.map((u) => u.id) ?? [];

  const { data: transactions } = await supabase
    .from("transactions")
    .select("user_id, amount_coins, description, type, created_at")
    .in("user_id", userIds)
    .eq("rating_exempt", false);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Рейтинг</h1>
      <RatingClient
        currentUserId={user.id}
        users={users ?? []}
        transactions={transactions ?? []}
        showCategories
      />
    </div>
  );
}
