import { createClient } from "@/lib/supabase-server";

export default async function RatingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: users } = await supabase
    .from("users")
    .select("id, name, total_earned")
    .eq("role", "mop")
    .order("total_earned", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Рейтинг</h1>
      <p className="text-gray-500 text-sm">По всего заработано</p>

      <div className="space-y-2">
        {users?.map((u, i) => {
          const isMe = u.id === user.id;
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;

          return (
            <div
              key={u.id}
              className={`flex items-center justify-between rounded-xl p-4 border ${
                isMe
                  ? "bg-acid-400/10 border-acid-400"
                  : "bg-dark-800 border-dark-600"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-gray-500 w-6 text-center">
                  {medal ?? i + 1}
                </span>
                <span className={isMe ? "font-bold text-acid-400" : ""}>
                  {u.name} {isMe && "(вы)"}
                </span>
              </div>
              <span className="font-bold">{u.total_earned}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
