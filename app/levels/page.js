import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import { LEVELS, getLevelForAmount } from "@/lib/levels";

export default async function LevelsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("total_earned, role")
    .eq("id", user.id)
    .single();

  const totalEarned = profile?.total_earned ?? 0;
  const currentLevel = getLevelForAmount(totalEarned);

  const homeHref =
    profile?.role === "admin"
      ? "/admin"
      : profile?.role === "observer"
      ? "/observer"
      : "/mop";

  const reversedLevels = [...LEVELS].sort((a, b) => b.id - a.id);

  return (
    <div className="space-y-6">
      <Link href={homeHref} className="text-gray-500 text-sm">
        ← На главную
      </Link>
      <h1 className="text-2xl font-bold">🏆 Звания</h1>

      <div className="space-y-3">
        {reversedLevels.map((level) => {
          const isUnlocked = totalEarned >= level.min;
          const isCurrent = level.id === currentLevel.id;
          const needed = level.min - totalEarned;

          return (
            <div
              key={level.id}
              className={`rounded-2xl p-4 border bg-dark-800 ${
                isCurrent
                  ? "border-acid-400"
                  : isUnlocked
                  ? "border-dark-600"
                  : "border-dark-600 opacity-40"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{level.icon}</span>
                  <div>
                    <p className="font-bold">{level.name}</p>
                    <p className="text-xs text-gray-500">
                      от {level.min.toLocaleString("ru-RU")} coins
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {isUnlocked ? (
                    <span className="text-xs text-acid-400 font-semibold">
                      ✅ Открыто
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">
                      нужно ещё {needed.toLocaleString("ru-RU")} coins
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {level.reward
                  ? `🎁 Награда: ${level.reward.toLocaleString("ru-RU")} coins`
                  : "🎁 Скоро объявим"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
