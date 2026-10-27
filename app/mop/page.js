import { formatCoins, spinsNom } from "@/lib/plural";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import RequestActions from "@/components/RequestActions";
import BirthdayProfile from "@/components/BirthdayProfile";
import GoalWidget from "@/components/GoalWidget";
import WithdrawRequestButton from "@/components/WithdrawRequestButton";
import FlashSaleCard from "@/components/FlashSaleCard";
import TeamFeed from "@/components/TeamFeed";
import LiveBalance from "@/components/LiveBalance";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { CURRENT_ANNOUNCEMENT } from "@/lib/announcement";
import { createAdminClient } from "@/lib/supabase-admin";
import { recordTeamEvent } from "@/lib/teamEvents";
import { BONUS_CATEGORIES, bonusRewardText } from "@/lib/bonusCategories";
import { getTraineeOnboarding } from "@/lib/onboarding";
import OnboardingTrainee from "@/components/OnboardingTrainee";
import { getMonthEarned } from "@/lib/earnings";
import EarningsMiniChart from "@/components/EarningsMiniChart";
import { recentDaysAlmaty, almatyDayKey, formatPaymentDay, nowInAlmaty, currentMonthKeyAlmaty, monthRangeAlmaty } from "@/lib/timezone";
import { plural } from "@/lib/plural";
import Icon from "@/components/Icon";
import { effectiveRole, resolveViewer } from "@/lib/viewAs";
import { getMyWeekPlace, getMyMonthTier } from "@/lib/dashboardPulse";
import { WeekPlaceCard, MonthTierCard } from "@/components/DashboardPulse";
import TeamHomeCard, { RopWallet } from "@/components/TeamHomeCard";
import MentorHomeCard from "@/components/MentorHomeCard";
import { getTeamOverview } from "@/lib/teamStats";
import { getFeaturedTournament } from "@/lib/tournamentView";
import TournamentHomeCard from "@/components/TournamentHomeCard";
import ChestCard from "@/components/Chest";
import { getPendingChest, chestEligible } from "@/lib/chest";
import { showSurveyCard } from "@/lib/survey";
import SurveyPromoCard from "@/components/SurveyPromoCard";
import NewsHomeCard from "@/components/NewsHomeCard";
import ImportantNewsBanner from "@/components/ImportantNewsBanner";
import { loadNewsFor, NEWS_ROLES } from "@/lib/appNews";

// «По дороге» — только вещи и впечатления. Привилегии, подписки, особые
// призы и «+1% бонусом» не показываем: на экране они выглядят странно.
const SERVICE_CATEGORIES = ["привилегии", "секретные и особые призы", "подписки и сервисы"];
const SERVICE_TITLE = /бонус|фиксирован|посадить|на продажи|%/i;
function isRealThing(r) {
  if (r.is_variable) return false;
  if (SERVICE_CATEGORIES.includes(String(r.category ?? "").trim().toLowerCase())) return false;
  return !SERVICE_TITLE.test(r.title ?? "");
}

export default async function MopDashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Всё, что нужно для первого экрана, спрашиваем у базы одним залпом.
  // Раньше часть запросов шла следом, по очереди, и каждый ждал
  // предыдущего — на этом терялось примерно по пол-секунды на открытие.
  const chartDays = recentDaysAlmaty(10);
  const monthRange = monthRangeAlmaty(currentMonthKeyAlmaty());
  const chartStartIso = new Date(
    `${chartDays[0].key}T00:00:00+05:00`
  ).toISOString();

  // Чей кабинет открыт: свой или, в режиме просмотра, выбранного человека.
  const { viewId, watching } = await resolveViewer(supabase, user.id);

  const [
    { data: profile },
    { data: pendingRevenue },
    { data: pendingBonus },
    { data: fetchedGoal },
    { data: flashSaleRewards },
    { data: teamEvents },
    monthEarned,
    { data: chartInflows },
    weekPlace,
    { data: shopPrices },
    monthTier,
    tournament,
    chest,
    surveyForMe,
    newsAll,
    { data: monthPayments },
  ] = await Promise.all([
    supabase.from("users").select("*").eq("id", viewId).single(),
    supabase
      .from("revenue_requests")
      .select("*")
      .eq("user_id", viewId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("bonus_requests")
      .select("*")
      .eq("user_id", viewId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("user_goals")
      .select("*, rewards(title, image_url)")
      .eq("user_id", viewId)
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
    getMonthEarned(supabase, viewId),
    supabase
      .from("transactions")
      .select("amount_coins, created_at")
      .eq("user_id", viewId)
      .gt("amount_coins", 0)
      .gte("created_at", chartStartIso),
    getMyWeekPlace(supabase, viewId),
    supabase
      .from("rewards")
      .select("id, title, price_coins, image_url, category, is_variable")
      .eq("is_active", true)
      .order("price_coins", { ascending: true }),
    getMyMonthTier(supabase, viewId),
    // Турнир, если идёт запись или игра. Сбой здесь не должен ронять главную.
    getFeaturedTournament(createAdminClient(), { id: viewId }).catch(() => null),
    // Сундук открывает только сам человек, не админ в режиме просмотра.
    viewId === user.id ? getPendingChest(createAdminClient(), user.id).catch(() => null) : null,
    // Опрос команды: карточка, пока он открыт и человек его не прошёл.
    viewId === user.id ? showSurveyCard(createAdminClient(), user.id) : false,
    // Новости приложения: пока таблиц нет, вернётся пустой список.
    loadNewsFor(createAdminClient(), viewId, 20),
    // Оплаты текущего месяца для карточки «Мои оплаты»
    supabase
      .from("revenue_requests")
      .select("amount_kzt, status")
      .eq("user_id", viewId)
      .or(
        `and(earned_at.gte.${monthRange.start},earned_at.lt.${monthRange.end}),and(earned_at.is.null,created_at.gte.${monthRange.start},created_at.lt.${monthRange.end})`
      )
      .limit(500),
  ]);

  const approvedPayments = (monthPayments ?? []).filter((r) => r.status === "approved");
  const approvedSum = approvedPayments.reduce((sum, r) => sum + (Number(r.amount_kzt) || 0), 0);

  const hasPending =
    (pendingRevenue?.length ?? 0) > 0 || (pendingBonus?.length ?? 0) > 0;

  const chartByDay = Object.fromEntries(chartDays.map((d) => [d.key, 0]));
  for (const t of chartInflows ?? []) {
    const k = almatyDayKey(t.created_at);
    if (k in chartByDay) chartByDay[k] += t.amount_coins;
  }
  const chartSeries = chartDays.map((d) => ({ ...d, value: chartByDay[d.key] }));

  // Для админа роль может быть подменена режимом просмотра: он смотрит
  // кабинет глазами стажёра или РОПа. В базе роль при этом не меняется.
  const role = effectiveRole(watching ? "admin" : profile?.role);
  const isTrainee = role === "trainee";
  const isRop = role === "rop";

  // Новости видят сотрудники; гостю и наблюдателю не показываем.
  const newsRole = watching ? profile?.role : role;
  const showNews = !profile?.is_guest && NEWS_ROLES.includes(newsRole) && newsAll.length > 0;
  const newsUnread = newsAll.filter((n) => n.unread).length;
  // Плашка с важным только самому человеку: админ в режиме
  // просмотра ничего не видит и ничего не отмечает.
  const importantNews =
    showNews && !watching && NEWS_ROLES.includes(profile?.role)
      ? newsAll
          .filter((n) => n.important && n.unread)
          .reverse()
          .map((n) => ({ id: n.id, title: n.title, body: n.body }))
      : [];
  const teamOverview = isRop ? await getTeamOverview(createAdminClient(), viewId) : null;
  let ropName = null;
  let onboardingDays = null;
  if (isTrainee) {
    // У админа своего проекта нет, а смотреть пустое обучение бессмысленно —
    // показываем материалы первого проекта, чтобы экран был как у стажёра.
    let projectId = profile?.project_id ?? null;
    if (!projectId && profile?.role === "admin") {
      const { data: anyProject } = await supabase
        .from("projects")
        .select("id")
        .eq("is_active", true)
        .order("name")
        .limit(1)
        .maybeSingle();
      projectId = anyProject?.id ?? null;
    }

    const [{ data: rop }, days] = await Promise.all([
      profile?.rop_id
        ? supabase.from("users").select("name").eq("id", profile.rop_id).single()
        : Promise.resolve({ data: null }),
      getTraineeOnboarding(createAdminClient(), viewId, projectId),
    ]);
    ropName = rop?.name ?? null;
    onboardingDays = days;
  }

  // Без цели подсказываем ближайшую награду, на которую ещё не хватает:
  // «Донер — ещё 300 коинов» понятнее, чем пустое «на что копишь?».
  const nextReward =
    (shopPrices ?? []).find((r) => r.price_coins > (profile?.balance ?? 0) && isRealThing(r)) ?? null;

  // «По дороге»: ближайшая награда дороже текущего баланса, но дешевле цели.
  const goalTarget = fetchedGoal?.target_amount ?? Infinity;
  const waypoint =
    (shopPrices ?? []).find(
      (r) =>
        r.price_coins > (profile?.balance ?? 0) &&
        r.price_coins < goalTarget &&
        isRealThing(r)
    ) ?? null;

  let currentGoal = fetchedGoal;
  if (!watching && currentGoal && (profile?.balance ?? 0) >= currentGoal.target_amount) {
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

  // Карточка турнира на главной уже есть — баннер про турнир не дублируем.
  const tournamentShown = tournament?.status === "registration" || tournament?.status === "running";

  const canJoinTournament =
    !profile?.is_guest && ["mop", "rop", "mentor", "admin"].includes(profile?.role);
  const ribbons = [];
  if ((profile?.wheel_spins ?? 0) > 0) {
    ribbons.push({
      key: "wheel",
      href: "/mop/games/wheel",
      icon: "wheel",
      text: `У тебя ${profile.wheel_spins} ${spinsNom(profile.wheel_spins)} на колесе фортуны`,
    });
  }
  if (tournament?.status === "registration" && !tournament.joined && canJoinTournament) {
    ribbons.push({
      key: "tournament",
      href: `/mop/games/tournament/${tournament.id}`,
      icon: "trophy",
      text: `Идёт запись на турнир, в банке ${Number(tournament.pot || 0).toLocaleString("ru-RU")}`,
    });
  } else if (tournament?.status === "running" && tournament.waitingMe) {
    ribbons.push({
      key: "tournament",
      href: `/mop/games/tournament/${tournament.id}`,
      icon: "trophy",
      text: "Соперник ждёт твоего ответа по матчу",
    });
  }

  return (
    <div className="space-y-6">
      {CURRENT_ANNOUNCEMENT && !(CURRENT_ANNOUNCEMENT.hideWhenTournament && tournamentShown) && (
        <AnnouncementBanner
          storageKey={CURRENT_ANNOUNCEMENT.storageKey}
          icon={CURRENT_ANNOUNCEMENT.icon}
          title={CURRENT_ANNOUNCEMENT.title}
          text={CURRENT_ANNOUNCEMENT.text}
          href={CURRENT_ANNOUNCEMENT.href}
        />
      )}

      <div>
        <p className="text-gray-500 text-sm">Привет, {profile?.name}</p>
      </div>

      {showNews && <NewsHomeCard latest={newsAll[0]} unread={newsUnread} />}
      {importantNews.length > 0 && <ImportantNewsBanner items={importantNews} />}

      {chestEligible(profile) && <ChestCard chest={chest} />}

      {surveyForMe && <SurveyPromoCard dismissible />}

      {isTrainee && (
        <OnboardingTrainee days={onboardingDays ?? []} ropName={ropName} />
      )}

      {!profile?.is_guest && (
        <BirthdayProfile birthday={profile?.birthday} variant="prompt" />
      )}

      {/* У РОПа сверху команда, личные коины компактно: руководителю важнее,
          как идут люди, чем кольцо баланса. */}
      {role === "mentor" && (
        <MentorHomeCard admin={createAdminClient()} mentorId={viewId} />
      )}
      {isRop && <TeamHomeCard overview={teamOverview} />}
      {isRop && (
        <RopWallet
          balance={profile?.balance ?? 0}
          monthEarned={monthEarned}
          goal={currentGoal}
        />
      )}

      {/* Лента над монетой: одна строка про то, что горит прямо сейчас */}
      {ribbons.map((r) => (
        <Link
          key={r.key}
          href={r.href}
          className="flex items-center gap-2.5 rounded-xl border border-acid-400/30 bg-acid-400/[0.07] px-3.5 py-2.5 active:opacity-70"
        >
          <Icon name={r.icon} className="w-5 h-5 text-acid-400 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-acid-400">{r.text}</span>
          <Icon name="chevronRight" className="w-4 h-4 text-gray-600 shrink-0" />
        </Link>
      ))}

      {/* Баланс — крупная цифра, обновляется онлайн */}
      {!isRop && (
        <LiveBalance
          userId={viewId}
          initialBalance={profile?.balance ?? 0}
          initialTotalEarned={profile?.total_earned ?? 0}
          initialMonthEarned={monthEarned}
          goalTarget={currentGoal?.target_amount ?? null}
          goalTitle={currentGoal?.rewards?.title ?? null}
        />
      )}

      {!isRop && (
        <GoalWidget
          goal={currentGoal}
          balance={profile?.balance ?? 0}
          coinRate={profile?.coin_rate_multiplier ?? 1}
          monthKzt={monthTier?.value ?? 0}
          suggestion={nextReward}
          monthCoins={monthEarned}
          dayOfMonth={nowInAlmaty().day}
          waypoint={waypoint}
        />
      )}

      {!profile?.is_guest && ["mop", "rop", "mentor"].includes(role) && (
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/mop/payments"
            className="rounded-2xl bg-dark-800 border border-dark-700 p-4 active:bg-dark-700 transition"
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-acid-400/10 text-acid-400">
              <Icon name="receipt" className="w-[18px] h-[18px]" />
            </span>
            <p className="font-semibold mt-3">Мои оплаты</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">
              {approvedPayments.length > 0
                ? `${approvedPayments.length} ${plural(approvedPayments.length, "оплата", "оплаты", "оплат")} · ${approvedSum.toLocaleString("ru-RU")} ₸`
                : "Подтверждённых пока нет"}
            </p>
          </Link>
          <Link
            href="/mop/recap"
            className={`rounded-2xl border p-4 transition ${
              nowInAlmaty().day <= 5
                ? "border-acid-400/40 bg-acid-400/[0.07]"
                : "bg-dark-800 border-dark-700 active:bg-dark-700"
            }`}
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-acid-400/10 text-acid-400">
              <Icon name="award" className="w-[18px] h-[18px]" />
            </span>
            <p className="font-semibold mt-3">Итог месяца</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">
              {nowInAlmaty().day <= 5 ? "Прошлый месяц уже готов" : "Как ты отработал"}
            </p>
          </Link>
        </div>
      )}

      <TournamentHomeCard
        t={tournament}
        canJoin={!profile?.is_guest && ["mop", "rop", "mentor", "admin"].includes(profile?.role)}
      />

      {flashSaleRewards?.map((reward) => (
        <FlashSaleCard
          key={reward.id}
          reward={reward}
          balance={profile?.balance ?? 0}
        />
      ))}


      {/* Стажёру оплаты, ставка и график заработка пока не нужны: вместо
          россыпи пустых плиток одна тихая закрытая карточка. */}
      {isTrainee ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-dark-600 bg-dark-800/60 p-4">
          <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-xl bg-dark-700 text-gray-500">
            <Icon name="lock" className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-gray-300">Откроется, когда станешь МОПом</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">
              Твои оплаты, ставка коинов и график заработка. Всё появится после первой подтверждённой оплаты.
            </p>
          </div>
        </div>
      ) : (
        <>
          <WeekPlaceCard data={weekPlace} />

          {!profile?.is_guest && role !== "admin" && role !== "observer" && (
            <MonthTierCard data={monthTier} />
          )}

          <EarningsMiniChart series={chartSeries} />
        </>
      )}

      {profile?.is_guest && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <p className="text-sm text-gray-400">
            Гостевой режим — общий демо-аккаунт. Можно всё посмотреть и
            купить что-нибудь в магазине; заявки на выручку и бонусы
            отправляют только сотрудники. Баланс сбрасывается каждую ночь.
          </p>
        </div>
      )}

      {/* Записать выручку / Бонус */}
      <RequestActions
        canSubmitRevenue={!profile?.is_guest && !watching && role !== "observer"}
        multiplier={profile?.coin_rate_multiplier ?? 1}
        monthKzt={monthTier?.value ?? 0}
      />

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
                <p className="text-xs text-gray-500 truncate">
                  {r.client_name ? `${r.client_name} · ` : ""}оплата за {formatPaymentDay(r.earned_at || r.created_at)}
                  {r.comment ? ` · ${r.comment}` : ""}
                </p>
              </div>
              <WithdrawRequestButton kind="revenue" id={r.id} />
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
                  {bonusRewardText(r)}
                  {r.comment ? ` · ${r.comment}` : ""}
                </p>
              </div>
              <WithdrawRequestButton kind="bonus" id={r.id} />
            </div>
          ))}
        </div>
      )}

      {!profile?.is_guest && <TeamFeed events={teamEvents ?? []} />}
    </div>
  );
}
