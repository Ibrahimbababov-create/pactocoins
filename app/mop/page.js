import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import RequestActions from "@/components/RequestActions";
import BirthdayProfile from "@/components/BirthdayProfile";
import GoalWidget from "@/components/GoalWidget";
import FlashSaleCard from "@/components/FlashSaleCard";
import TeamFeed from "@/components/TeamFeed";
import LiveBalance from "@/components/LiveBalance";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { CURRENT_ANNOUNCEMENT } from "@/lib/announcement";
import { createAdminClient } from "@/lib/supabase-admin";
import { recordTeamEvent } from "@/lib/teamEvents";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";
import { getTraineeOnboarding } from "@/lib/onboarding";
import OnboardingTrainee from "@/components/OnboardingTrainee";
import { getMonthEarned } from "@/lib/earnings";
import EarningsMiniChart from "@/components/EarningsMiniChart";
import { recentDaysAlmaty, almatyDayKey } from "@/lib/timezone";
import Icon from "@/components/Icon";

export default async function MopDashboard({ searchParams }) {
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
      .eq("kind", "purchase")
      .not("user_name", "like", "🤖%")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const hasPending =
    (pendingRevenue?.length ?? 0) > 0 || (pendingBonus?.length ?? 0) > 0;

  const monthEarned = await getMonthEarned(supabase, user.id);

  const chartDays = recentDaysAlmaty(10);
  const chartStartIso = new Date(`${chartDays[0].key}T00:00:00+05:00`).toISOString();
  const { data: chartInflows } = await supabase
    .from("transactions")
    .select("amount_coins, created_at")
    .eq("user_id", user.id)
    .gt("amount_coins", 0)
    .gte("created_at", chartStartIso);
  const chartByDay = Object.fromEntries(chartDays.map((d) => [d.key, 0]));
  for (const t of chartInflows ?? []) {
    const k = almatyDayKey(t.created_at);
    if (k in chartByDay) chartByDay[k] += t.amount_coins;
  }
  const chartSeries = chartDays.map((d) => ({ ...d, value: chartByDay[d.key] }));

  // Админ может заглянуть в стажёрский экран (?as=trainee) — только чтобы
  // проверить, как он выглядит, роль в базе при этом не меняется.
  const previewTrainee = profile?.role === "admin" && searchParams?.as === "trainee";
  const isTrainee = profile?.role === "trainee" || previewTrainee;
  let ropName = null;
  let onboardingDays = null;
  if (isTrainee) {
    if (profile?.rop_id) {
      const { data: rop } = await supabase
        .from("users")
        .select("name")
        .eq("id", profile.rop_id)
        .single();
      ropName = rop?.name ?? null;
    }
    onboardingDays = await getTraineeOnboarding(
      createAdminClient(),
      user.id,
      profile?.rop_id ?? null
    );
  }

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
      {CURRENT_ANNOUNCEMENT && (
        <AnnouncementBanner
          storageKey={CURRENT_ANNOUNCEMENT.storageKey}
          title={CURRENT_ANNOUNCEMENT.title}
          text={CURRENT_ANNOUNCEMENT.text}
          href="/mop/games"
        />
      )}

      <div>
        <p className="text-gray-500 text-sm">Привет, {profile?.name}</p>
      </div>

      {isTrainee && (
        <OnboardingTrainee days={onboardingDays ?? []} ropName={ropName} />
      )}

      {!profile?.is_guest && (
        <BirthdayProfile birthday={profile?.birthday} variant="prompt" />
      )}

      {profile?.role === "rop" && (
        <div className="bg-gradient-to-br from-purple-500/10 to-dark-800 border border-purple-500/30 rounded-2xl p-4">
          <p className="font-bold text-purple-300 flex items-center gap-2">
            <Icon name="sparkle" className="w-4 h-4" />
            Для РОПов скоро новинка
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Мы готовим отдельную функцию под твою должность. Пока всё
            работает как у МОПа — выручка, бонусы, магазин.
          </p>
        </div>
      )}

      {(profile?.wheel_spins ?? 0) > 0 && (
        <Link
          href="/mop/games"
          className="flex items-center gap-3 rounded-2xl border border-acid-400/30 bg-gradient-to-br from-acid-400/10 to-dark-800 p-4"
        >
          <Icon name="wheel" className="w-8 h-8 text-acid-400 shrink-0" />
          <div>
            <p className="font-bold text-acid-400">
              У тебя {profile.wheel_spins}{" "}
              {profile.wheel_spins === 1 ? "крутка" : "крутки"} на колесе фортуны
            </p>
            <p className="text-sm text-gray-400 mt-0.5">Нажми, чтобы крутить →</p>
          </div>
        </Link>
      )}

      {flashSaleRewards?.map((reward) => (
        <FlashSaleCard
          key={reward.id}
          reward={reward}
          balance={profile?.balance ?? 0}
        />
      ))}

      {/* Баланс — крупная цифра, обновляется онлайн */}
      <LiveBalance
        userId={user.id}
        initialBalance={profile?.balance ?? 0}
        initialTotalEarned={profile?.total_earned ?? 0}
        initialMonthEarned={monthEarned}
        goalTarget={currentGoal?.target_amount ?? null}
      />

      <EarningsMiniChart series={chartSeries} />

      <GoalWidget goal={currentGoal} balance={profile?.balance ?? 0} />

      {profile?.is_guest && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <p className="text-sm text-gray-400">
            Гостевой режим — это общий демо-аккаунт, баланс и заявки
            сбрасываются каждую ночь.
          </p>
        </div>
      )}

      {/* Записать выручку / Бонус */}
      <RequestActions />

      {/* Заявки в ожидании — янтарная точка вместо цветной плашки */}
      {hasPending && (
        <div className="space-y-2">
          {pendingRevenue?.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  {r.amount_kzt.toLocaleString("ru-RU")} ₸ ожидает подтверждения
                </p>
                {r.comment && (
                  <p className="text-xs text-gray-500 truncate">{r.comment}</p>
                )}
              </div>
            </div>
          ))}

          {pendingBonus?.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  {BONUS_CATEGORIES[r.category]?.label ?? r.category} ожидает
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {BONUS_CATEGORIES[r.category]?.spin
                    ? "крутка на колесе"
                    : `${r.amount_coins} коинов`}
                  {r.comment ? ` · ${r.comment}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!profile?.is_guest && <TeamFeed events={teamEvents ?? []} />}
    </div>
  );
}
