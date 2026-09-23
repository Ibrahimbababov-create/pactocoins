"use client";

import { useState, useMemo, useEffect } from "react";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase-browser";
import { WEEKLY_TOP, MONTHLY_TOP } from "@/lib/topBonusConfig";

const CATEGORY_TABS = [
  { key: "overall", label: "Общее" },
  { key: "revenue", label: "Выручка" },
  { key: "bonus", label: "Бонус" },
];

const PERIODS = [
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "all", label: "Всё время" },
];

// Пьедестал в фирменных цветах вместо золота/серебра/бронзы с медалями.
const PODIUM_TIERS = [
  { h: "h-28", bar: "from-acid-400/30 to-acid-400/5 border-acid-400/50", num: "text-acid-400", name: "text-acid-400" },
  { h: "h-20", bar: "from-white/20 to-white/5 border-white/30", num: "text-gray-100", name: "text-gray-100" },
  { h: "h-14", bar: "from-white/10 to-white/[0.02] border-white/15", num: "text-gray-400", name: "text-gray-400" },
];

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const MONTHS_RU_NOM = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

// «21–27 сентября» для недели, «сентябрь 2026» для месяца.
function formatRange(start, end, mode) {
  if (mode === "month") {
    return `${MONTHS_RU_NOM[start.getMonth()]} ${start.getFullYear()}`;
  }
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_RU[end.getMonth()]}`;
  }
  return `${start.getDate()} ${MONTHS_RU[start.getMonth()]} – ${end.getDate()} ${MONTHS_RU[end.getMonth()]}`;
}

export default function RatingClient({ currentUserId, users, showCategories = true }) {
  const [tab, setTab] = useState("overall");
  const [periodMode, setPeriodMode] = useState("week");
  const [pickedDate, setPickedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [totals, setTotals] = useState({}); // { [userId]: { overall, revenue, bonus } }
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    const d = new Date(pickedDate + "T00:00:00");
    if (periodMode === "week") {
      return { start: startOfWeek(d), end: endOfWeek(d) };
    }
    return { start: startOfMonth(d), end: endOfMonth(d) };
  }, [pickedDate, periodMode]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const supabase = createClient();

    const p_start = periodMode === "all" ? null : range.start.toISOString();
    const p_end = periodMode === "all" ? null : range.end.toISOString();

    supabase
      .rpc("rating_totals", { p_start, p_end })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.error("[RatingClient] rating_totals", error);
          setTotals({});
          setLoading(false);
          return;
        }
        const map = {};
        for (const row of data ?? []) {
          const bucket = (map[row.user_id] ||= { overall: 0, revenue: 0, bonus: 0 });
          bucket.overall += row.total;
          if (row.source === "revenue") bucket.revenue += row.total;
          else bucket.bonus += row.total;
        }
        setTotals(map);
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [periodMode, range]);

  const { ranked, zeroCount } = useMemo(() => {
    const withValues = users.map((u) => ({
      id: u.id,
      name: u.name,
      value: totals[u.id]?.[tab] ?? 0,
      totalEarned: u.total_earned ?? 0,
      isActive: u.is_active !== false,
    }));
    const nonZero = withValues.filter((u) => u.value > 0);
    nonZero.sort((a, b) => b.value - a.value);
    // "Ещё не начали" — только про тех, кто сейчас реально в строю.
    // Уволенные с нулём за период это не "не начал", а просто не в счёт;
    // если у уволенного есть заработок за период (или за всё время), он
    // всё равно останется виден в списке выше — это не трогаем.
    const zeroCount = withValues.filter((u) => u.value === 0 && u.isActive).length;
    return { ranked: nonZero, zeroCount };
  }, [tab, totals, users]);

  function shiftPeriod(direction) {
    const d = new Date(pickedDate + "T00:00:00");
    if (periodMode === "week") {
      d.setDate(d.getDate() + direction * 7);
    } else {
      d.setMonth(d.getMonth() + direction);
    }
    setPickedDate(d.toISOString().slice(0, 10));
  }

  function goToday() {
    setPickedDate(new Date().toISOString().slice(0, 10));
  }

  const fmt = (n) => Number(n).toLocaleString("ru-RU");
  const myIndex = ranked.findIndex((u) => u.id === currentUserId);
  const podium = ranked.length >= 3;
  const listStart = podium ? 3 : 0;

  const now = new Date();
  const atLatest = periodMode === "all" || (range.start <= now && now <= range.end);
  const prizeCfg =
    atLatest && periodMode === "week"
      ? WEEKLY_TOP
      : atLatest && periodMode === "month"
      ? MONTHLY_TOP
      : null;

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {showCategories && (
        <div className="grid grid-cols-3 gap-1 bg-dark-800 border border-dark-600 rounded-xl p-1">
          {CATEGORY_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`py-2 rounded-lg text-sm font-semibold transition active:scale-95 ${
                tab === t.key ? "bg-acid-400/15 text-acid-400" : "text-gray-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 bg-dark-800 border border-dark-600 rounded-xl p-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriodMode(p.key)}
            className={`py-2 rounded-lg text-sm font-semibold transition active:scale-95 ${
              periodMode === p.key ? "bg-acid-400/15 text-acid-400" : "text-gray-400"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {periodMode !== "all" && (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => shiftPeriod(-1)}
            aria-label="Раньше"
            className="w-9 h-9 shrink-0 rounded-full bg-dark-800 border border-dark-600 flex items-center justify-center text-gray-400 active:scale-95"
          >
            <Icon name="chevronLeft" className="w-4 h-4" />
          </button>

          <div className="text-center min-w-0">
            <p className="text-sm font-semibold truncate">
              {formatRange(range.start, range.end, periodMode)}
            </p>
            {!atLatest && (
              <button onClick={goToday} className="text-xs text-acid-400 active:underline">
                вернуться к текущей
              </button>
            )}
          </div>

          <button
            onClick={() => shiftPeriod(1)}
            disabled={atLatest}
            aria-label="Позже"
            className="w-9 h-9 shrink-0 rounded-full bg-dark-800 border border-dark-600 flex items-center justify-center text-gray-400 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
          >
            <Icon name="chevronRight" className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
      ) : (
        <>
          {podium && (
            <div className="pt-2">
              <div className="flex items-end gap-2">
                {[1, 0, 2].map((idx) => {
                  const u = ranked[idx];
                  if (!u) return <div key={idx} className="flex-1" />;
                  const isMe = u.id === currentUserId;
                  const tier = PODIUM_TIERS[idx];
                  const prize = prizeCfg?.prizes[idx];
                  return (
                    <div key={u.id} className="flex-1 flex flex-col items-center min-w-0">
                      {idx === 0 && (
                        <Icon name="trophy" className="w-5 h-5 text-acid-400 mb-0.5" />
                      )}
                      <span
                        className={`text-xs font-bold truncate max-w-full inline-flex items-center gap-1 ${
                          isMe ? "text-acid-400" : tier.name
                        }`}
                      >
                        {u.name}
                        {isMe && (
                          <span className="px-1 rounded bg-acid-400 text-black text-[9px] font-black leading-tight">
                            ВЫ
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-black tabular-nums">{fmt(u.value)}</span>
                      {prize != null && (
                        <span className="text-[11px] font-semibold text-gray-400 tabular-nums">
                          +{fmt(prize)}
                        </span>
                      )}
                      <div
                        className={`mt-2 w-full rounded-t-xl border bg-gradient-to-b ${tier.bar} ${tier.h} flex items-start justify-center pt-1.5`}
                      >
                        <span className={`text-xl font-black ${tier.num}`}>{idx + 1}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {prizeCfg && (
                <p className="mt-2 text-xs text-gray-500 text-center">
                  Приз {prizeCfg.label} — тем, кто набрал от {fmt(prizeCfg.min)} коинов.
                </p>
              )}
            </div>
          )}

          {myIndex >= listStart && (
            <div className="flex items-center justify-between rounded-xl p-3 bg-acid-400/10 border border-acid-400 ring-1 ring-acid-400/30 text-sm">
              <span className="font-bold text-acid-400">Вы&nbsp;#{myIndex + 1}</span>
              <span className="text-gray-300 tabular-nums">
                {myIndex > 0 &&
                  `до #${myIndex}: +${fmt(ranked[myIndex - 1].value - ranked[myIndex].value)} · `}
                {fmt(ranked[myIndex].value)}
              </span>
            </div>
          )}

          <div className="space-y-2">
            {ranked.slice(listStart).map((u, i) => {
              const rank = listStart + i + 1;
              const isMe = u.id === currentUserId;

              return (
                <div
                  key={u.id}
                  className={`flex items-center justify-between rounded-xl p-4 border ${
                    isMe
                      ? "bg-acid-400/10 border-acid-400 ring-1 ring-acid-400/30"
                      : "bg-dark-800 border-dark-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-500 w-6 text-center tabular-nums">
                      {rank}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 ${isMe ? "font-bold text-acid-400" : ""}`}>
                      {u.name}
                      {isMe && (
                        <span className="px-1.5 rounded bg-acid-400 text-black text-[10px] font-black">
                          ВЫ
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="font-bold tabular-nums">{fmt(u.value)}</span>
                </div>
              );
            })}

            {zeroCount > 0 && (
              <div className="rounded-xl p-3 text-center text-sm text-gray-500 border border-dashed border-dark-600">
                ещё {zeroCount} {zeroCount === 1 ? "не начал" : "не начали"}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
