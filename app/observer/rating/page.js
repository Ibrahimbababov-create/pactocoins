import { createClient } from "@/lib/supabase-server";
import RatingClient from "@/components/RatingClient";

export default async function ObserverRating() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Без фильтра is_active: уволенный, но реально заработавший в прошлом
  // сотрудник должен оставаться виден в истории рейтинга — под своим именем.
  const { data: users } = await supabase
    .from("users")
    .select("id, name, total_earned, is_active")
    .eq("role", "mop")
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Рейтинг</h1>
      <RatingClient currentUserId={user.id} users={users ?? []} />
    </div>
  );
}
