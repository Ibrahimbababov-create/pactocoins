import Link from "next/link";
import Icon from "@/components/Icon";
import { plural } from "@/lib/plural";
import { DayBars, DeltaChip, kzt, kztShort } from "@/components/TeamViz";

// Главная карточка РОПа: как идёт команда прямо сейчас. Сверху деньги и
// динамика к прошлому месяцу, ниже, кто молчит и что ждёт решения.
export default function TeamHomeCard({ overview }) {
  if (!overview) return null;
  const people = overview.people;

  if (people.length === 0) {
    return (
      <Link
        href="/mop/team"
        className="flex items-center gap-3 bg-dark-800 border border-dark-600 rounded-2xl p-4"
      >
        <Icon name="users" className="w-8 h-8 text-gray-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">В команде пока никого</p>
          <p className="text-sm text-gray-400 mt-0.5">Добавь своих МОПов, чтобы видеть их выручку</p>
        </div>
        <Icon name="chevronRight" className="w-5 h-5 text-gray-600 shrink-0" />
      </Link>
    );
  }

  const paid = people.filter((m) => m.month_kzt > 0).length;
  const best = [...people].sort((a, b) => b.month_kzt - a.month_kzt)[0];
  const quiet = overview.quiet;

  return (
    <Link
      href="/mop/team"
      className="block bg-dark-800 border border-dark-600 rounded-2xl p-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Твоя команда · {overview.monthLabel}</p>
        <Icon name="chevronRight" className="w-4 h-4 text-gray-600" />
      </div>
      <p className="font-display text-3xl font-bold tabular-nums mt-1">{kzt(overview.total)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <DeltaChip now={overview.total} before={overview.prevSame} label="к прошлому месяцу" />
        {overview.prevSame > 0 && <span className="text-xs text-gray-500">за те же дни</span>}
      </div>

      <div className="mt-4">
        <DayBars days={overview.days} values={overview.teamSeries} height={48} />
        <div className="flex justify-between text-[10px] text-gray-600 mt-1">
          <span>{overview.days[0].label}</span>
          <span>сегодня</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="rounded-xl bg-dark-700/60 px-3 py-2">
          <p className="text-[11px] text-gray-500">Сегодня</p>
          <p className="text-sm font-bold tabular-nums mt-0.5">{kztShort(overview.today)}</p>
        </div>
        <div className="rounded-xl bg-dark-700/60 px-3 py-2">
          <p className="text-[11px] text-gray-500">Неделя</p>
          <p className="text-sm font-bold tabular-nums mt-0.5">{kztShort(overview.week)}</p>
        </div>
        <div className="rounded-xl bg-dark-700/60 px-3 py-2">
          <p className="text-[11px] text-gray-500">С оплатами</p>
          <p className="text-sm font-bold tabular-nums mt-0.5">
            {paid} из {people.length}
          </p>
        </div>
      </div>

      {quiet.length > 0 && (
        <div className="flex items-start gap-2 mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1.5" />
          <p className="text-xs text-gray-300 leading-snug">
            Неделю без оплат:{" "}
            <span className="text-amber-400">
              {quiet
                .slice(0, 3)
                .map((m) => m.name)
                .join(", ")}
              {quiet.length > 3 && ` и ещё ${quiet.length - 3}`}
            </span>
          </p>
        </div>
      )}

      {overview.pending > 0 && (
        <p className="text-xs text-amber-400 mt-2">
          Ждут одобрения: {overview.pending}{" "}
          {plural(overview.pending, "заявка", "заявки", "заявок")}
        </p>
      )}

      {best?.month_kzt > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          Лучший сейчас: <span className="text-gray-300">{best.name}</span> · {kztShort(best.month_kzt)}
        </p>
      )}
    </Link>
  );
}

// Личные коины РОПа: здесь они второстепенны, поэтому одной строкой, а не
// большим кольцом, как у МОПа.
export function RopWallet({ balance, monthEarned, goal }) {
  const target = goal?.target_amount ?? null;
  const pct = target ? Math.min(100, Math.round((balance / target) * 100)) : null;
  return (
    <Link
      href="/mop/history"
      className="block bg-dark-800 border border-dark-600 rounded-2xl p-4"
    >
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-acid-400/10 text-acid-400 shrink-0">
          <Icon name="coin" className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500">Мои коины</p>
          <p className="font-display text-2xl font-bold tabular-nums leading-tight">
            {Number(balance || 0).toLocaleString("ru-RU")}
          </p>
        </div>
        {monthEarned > 0 && (
          <span className="text-xs font-semibold text-acid-400 bg-acid-400/10 rounded-full px-2.5 py-1 tabular-nums shrink-0">
            +{Number(monthEarned).toLocaleString("ru-RU")} за месяц
          </span>
        )}
      </div>
      {target && (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-dark-600 overflow-hidden">
            <div className="h-full rounded-full bg-acid-400/70" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-1.5 truncate">
            Копишь на {goal.rewards?.title ?? "цель"} · {pct}%
          </p>
        </div>
      )}
    </Link>
  );
}
