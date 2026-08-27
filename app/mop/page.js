import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import RevenueRequestForm from "@/components/RevenueRequestForm";
import BonusRequestForm from "@/components/BonusRequestForm";
import BirthdayProfile from "@/components/BirthdayProfile";
import GoalWidget from "@/components/GoalWidget";
import FlashSaleCard from "@/components/FlashSaleCard";
import LevelUpCelebration from "@/components/LevelUpCelebration";
import TeamFeed from "@/components/TeamFeed";
import AnimatedNumber from "@/components/AnimatedNumber";
import { createAdminClient } from "@/lib/supabase-admin";
import { recordTeamEvent } from "@/lib/teamEvents";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";
import { getLevelForAmount } from "@/lib/levels";

export default async function MopDashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profile },
    { data: pendingRevenue },
    { data: pendingBonus },
    { data: fetchedGoal },
    { data: flashSaleRewards },
    { data: teamEvents },
  ] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).single(),
    supabase
      .from("revenue_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("bonus_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("user_goals")
      .select("*, rewards(title, image_url)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("rewards")
      .select("*")
      .eq("is_active", true)
      .not("sale_price_coins", "is", null)
      .not("sale_ends_at", "is", null)
      .gt("sale_ends_at", new Date().toISOString()),
    supabase
      .from("team_events")
      .select("id, user_name, kind, title, icon, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const hasPending =
    (pendingRevenue?.length ?? 0) > 0 || (pendingBonus?.length ?? 0) > 0;

  // Достиг нового ранга и ещё не видел полноэкранную анимацию про него.
  const currentLevel = getLevelForAmount(profile?.total_earned ?? 0);
  const showLevelUp =
    !!profile && currentLevel.id > (profile.celebrated_level_id ?? 1);

  let currentGoal = fetchedGoal;
  if (currentGoal && (profile?.balance ?? 0) >= currentGoal.target_amount) {
    const { data: achievedGoal } = await supabase
      .from("user_goals")
      .update({ status: "achieved", updated_at: new Date().toISOString() })
      .eq("id", currentGoal.id)
      .select("*, rewards(title, image_url)")
      .single();
    if (achievedGoal) {
      currentGoal = achievedGoal;
      if (!profile?.is_guest) {
        await recordTeamEvent(createAdminClient(), {
          userId: user.id,
          userName: profile?.name ?? "Кто-то",
          kind: "goal_achieved",
          title: achievedGoal.rewards?.title ?? "цель",
          icon: "🎯",
        });
      }
    }
  }

  return (
    <div className="space-y-6">
      {showLevelUp && <LevelUpCelebration level={currentLevel} />}

      <div>
        <p className="text-gray-500 text-sm">Привет, {profile?.name}</p>
        <h1 className="text-2xl font-bold">PactoCoins</h1>
      </div>

      {profile?.role === "rop" && (
        <div className="bg-gradient-to-br from-purple-500/10 to-dark-800 border border-purple-500/30 rounded-2xl p-4">
          <p className="font-bold text-purple-300">🚀 Для РОПов скоро новинка</p>
          <p className="text-sm text-gray-400 mt-1">
            Мы готовим отдельную функцию под вашу должность. Пока всё
            работает как у МОПа — выручка, бонусы, магазин.
          </p>
        </div>
      )}

      {flashSaleRewards?.map((reward) => (
        <FlashSaleCard
          key={reward.id}
          reward={reward}
          balance={profile?.balance ?? 0}
        />
      ))}

      {/* Баланс — крупная цифра */}
      <div className="bg-gradient-to-br from-dark-800 to-dark-700 border border-dark-600 rounded-3xl p-6">
        <p className="text-gray-500 text-sm mb-1">Текущий баланс</p>
        <AnimatedNumber
          value={profile?.balance ?? 0}
          storageKey="pc-anim-balance"
          format={false}
          className="block text-6xl font-black text-acid-400 tracking-tight"
        />
        <p className="text-gray-500 text-sm mt-1">coins</p>

        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-dark-600">
          <div>
            <p className="text-gray-500 text-xs">Всего заработано</p>
            <p className="text-xl font-bold">{profile?.total_earned ?? 0}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">За этот месяц</p>
            <p className="text-xl font-bold">{profile?.month_earned ?? 0}</p>
          </div>
        </div>
      </div>

      <GoalWidget goal={currentGoal} balance={profile?.balance ?? 0} />

      {!profile?.is_guest && <TeamFeed events={teamEvents ?? []} />}

      <BirthdayProfile birthday={profile?.birthday} />

      {profile?.is_guest && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <p className="text-sm text-gray-400">
            👀 Гостевой режим — это общий демо-аккаунт, баланс и заявки
            сбрасываются каждую ночь.
          </p>
        </div>
      )}

      {/* Заявка на выручку */}
      <RevenueRequestForm />

      {/* Заявка на бонус */}
      <BonusRequestForm />

      {/* Заявки в ожидании */}
      {hasPending && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Ожидают подтверждения</p>

          {pendingRevenue?.map((r) => (
            <div
              key={r.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold">
                  {r.amount_kzt.toLocaleString("ru-RU")} ₸
                </p>
                <p className="text-xs text-gray-500">{r.comment}</p>
              </div>
              <span className="text-xs bg-yellow-500/10 text-yellow-400 px-3 py-1 rounded-full">
                Ожидает
              </span>
            </div>
          ))}

          {pendingBonus?.map((r) => (
            <div
              key={r.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold">
                  {BONUS_CATEGORIES[r.category]?.label ?? r.category}
                </p>
                <p className="text-xs text-gray-500">
                  {r.amount_coins} coins
                  {r.comment ? ` · ${r.comment}` : ""}
                </p>
              </div>
              <span className="text-xs bg-yellow-500/10 text-yellow-400 px-3 py-1 rounded-full">
                Ожидает
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
