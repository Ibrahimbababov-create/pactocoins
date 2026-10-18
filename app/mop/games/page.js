import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getFeaturedTournament } from "@/lib/tournamentView";
import Icon from "@/components/Icon";
import { isWheelOpen, formatOpensAt } from "@/lib/wheel";
import { formatCoins, spinsNom } from "@/lib/plural";
import ChestCard from "@/components/Chest";
import { getPendingChest, chestEligible } from "@/lib/chest";

export const dynamic = "force-dynamic";

// Вкладка «Игры» — сначала список игр, каждая открывается своим экраном.
// Новая игра = новая карточка здесь и свой экран в app/mop/games/<игра>.

function GameCard({ href, icon, title, text, badge }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-2xl border border-dark-600 bg-dark-800 p-4 active:bg-dark-700 transition"
    >
      <span className="flex items-center justify-center w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-acid-400/25 to-acid-400/5 border border-acid-400/30 text-acid-400">
        <Icon name={icon} className="w-6 h-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-bold truncate">{title}</span>
          {badge && (
            <span className="shrink-0 rounded-full bg-acid-400 text-black text-[10px] font-bold px-2 py-0.5">
              {badge}
            </span>
          )}
        </span>
        <span className="block text-sm text-gray-500 mt-0.5">{text}</span>
      </span>
      <Icon name="chevronRight" className="w-4 h-4 shrink-0 text-gray-600" />
    </Link>
  );
}

// Турнир — крупно и первым: банк, статус, твой матч.
function TournamentCard({ t }) {
  const myTurn = t.myMatch && t.myMatch.status !== "disputed";
  const line =
    t.status === "registration"
      ? t.joined
        ? "Ты участвуешь, ждём старта"
        : t.entry_fee > 0
          ? `Взнос ${formatCoins(t.entry_fee)}, победитель забирает всё`
          : "Участие бесплатное"
      : t.status === "finished"
        ? `Победитель: ${t.winnerName ?? "определён"}`
        : t.waitingMe
          ? "Соперник отметил итог, ждёт твоего ответа"
          : myTurn
            ? "Твой матч ждёт итога"
            : "Идёт турнир, следи за сеткой";
  const badge =
    t.status === "registration" ? "Запись" : t.status === "finished" ? "Итоги" : myTurn ? "Твой матч" : "Идёт";
  return (
    <Link
      href={`/mop/games/tournament/${t.id}`}
      className="block rounded-2xl border border-acid-400/40 bg-gradient-to-br from-acid-400/15 via-dark-800 to-dark-800 p-4 active:opacity-80 transition"
    >
      <div className="flex items-center gap-3.5">
        <span className="flex items-center justify-center w-12 h-12 shrink-0 rounded-xl bg-acid-400 text-black">
          <Icon name="trophy" className="w-6 h-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-bold truncate">{t.title}</span>
            <span className="shrink-0 rounded-full bg-acid-400 text-black text-[10px] font-bold px-2 py-0.5">
              {badge}
            </span>
          </span>
          <span className="block text-xs text-gray-500">Турнир Clash Royale · игроков {t.players}</span>
        </span>
        <Icon name="chevronRight" className="w-4 h-4 shrink-0 text-gray-600" />
      </div>
      {t.status !== "finished" && (
        <p className="mt-3 text-2xl font-display font-bold text-acid-400 tabular-nums">
          {Number(t.pot || 0).toLocaleString("ru-RU")} <span className="text-sm font-sans font-normal text-gray-400">коинов в банке</span>
        </p>
      )}
      <p className="mt-1 text-sm text-gray-400">{line}</p>
    </Link>
  );
}

// Игра, которой ещё нет: такой же широкий ряд, только приглушённый.
function SoonRow({ icon, title, text }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-dashed border-dark-600 p-4">
      <span className="flex items-center justify-center w-12 h-12 shrink-0 rounded-xl bg-dark-700 text-gray-500">
        <Icon name={icon} className="w-6 h-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-bold text-gray-300 truncate">{title}</span>
          <span className="shrink-0 rounded-full border border-dark-600 text-gray-500 text-[10px] font-semibold px-2 py-0.5">
            Скоро
          </span>
        </span>
        <span className="block text-sm text-gray-500 mt-0.5">{text}</span>
      </span>
    </div>
  );
}

export default async function GamesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: config }, { data: profile }] = await Promise.all([
    supabase
      .from("wheel_config")
      .select("spin_price_coins, buy_enabled, is_open, opens_at")
      .eq("id", true)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id, role, wheel_spins, is_active, is_guest, email")
      .eq("id", user.id)
      .single(),
  ]);
  const [tournament, chest] = await Promise.all([
    getFeaturedTournament(createAdminClient(), profile),
    chestEligible(profile) ? getPendingChest(createAdminClient(), user.id).catch(() => null) : null,
  ]);

  const spins = profile?.wheel_spins ?? 0;
  const wheelOpen = isWheelOpen(config);
  const opensAt = formatOpensAt(config?.opens_at);
  const wheelText = !wheelOpen
    ? opensAt
      ? `Закрыто, откроется ${opensAt}`
      : "Закрыто, скоро откроем"
    : spins > 0
      ? "Крути и забирай призы"
      : config?.buy_enabled
        ? `Крутка за ${formatCoins(config.spin_price_coins)}`
        : "Крутки дают за работу и достижения";

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-display font-bold">Игры</h1>

      {/* Все игры одним списком, по порядку: сундук (если есть подарок),
          турнир, колесо, дальше новые. */}
      <div className="space-y-2.5">
        {chest && <ChestCard chest={chest} />}
        {tournament ? (
          <>
            <TournamentCard t={tournament} />
            {tournament.status === "running" && (
              <Link
                href={`/mop/games/tournament/${tournament.id}/live`}
                className="flex items-center gap-2.5 rounded-xl border border-dark-600 px-4 py-2.5 text-sm text-gray-300 active:bg-dark-700 transition"
              >
                <Icon name="eye" className="w-4 h-4 shrink-0 text-acid-400" />
                <span className="flex-1">Смотреть игру онлайн</span>
                <Icon name="chevronRight" className="w-4 h-4 shrink-0 text-gray-600" />
              </Link>
            )}
          </>
        ) : (
          <SoonRow icon="trophy" title="Турнир Clash Royale" text="Общий банк забирает победитель" />
        )}
        <GameCard
          href="/mop/games/wheel"
          icon="wheel"
          title="Колесо фортуны"
          text={wheelText}
          badge={wheelOpen && spins > 0 ? `${spins} ${spinsNom(spins)}` : null}
        />
        <SoonRow icon="target" title="Морской бой" text="Один на один с коллегой" />
      </div>
    </div>
  );
}
