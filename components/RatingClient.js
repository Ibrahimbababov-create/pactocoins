"use client";

import { useState, useMemo } from "react";
import Icon from "@/components/Icon";
import { WEEKLY_TOP, MONTHLY_TOP } from "@/lib/topBonusConfig";

const CATEGORY_TABS = [
  { key: "overall", label: "Общее" },
  { key: "revenue", label: "Выручка" },
  { key: "bonus", label: "Достижения" },
];

const PERIODS = [
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "all", label: "Всё время" },
];

// Пьедестал в «металлических» цветах: золото / серебро / бронза.
// idx: 0 — 1 место, 1 — 2 место, 2 — 3 место.
const MEDALS = [
  {
    emoji: "🥇",
    h: "h-28",
    bar: "from-amber-300/35 to-amber-500/5 border-amber-400/60",
    num: "text-amber-300",
    name: "text-amber-300",
    glow: "shadow-[0_0_26px_-6px_rgba(251,191,36,0.6)]",
  },
  {
    emoji: "🥈",
    h: "h-20",
    bar: "from-slate-200/30 to-slate-400/5 border-slate-300/50",
    num: "text-slate-100",
    name: "text-slate-200",
    glow: "shadow-[0_0_18px_-8px_rgba(226,232,240,0.55)]",
  },
  {
    emoji: "🥉",
    h: "h-14",
    bar: "from-orange-400/30 to-orange-700/5 border-orange-500/50",
    num: "text-orange-300",
    name: "text-orange-300",
    glow: "",
  },
];

function classify(desc) {
  if (desc?.startsWith("Выручка подтверждена")) return "revenue";
  if (desc?.startsWith("Бонус:") || desc?.startsWith("ТОП-")) return "bonus";
  return "other";
}

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

function stripEra(s) {
  return s.replace(/\s*г\.?\s*$/i, "");
}

function formatRange(start, end, mode) {
  if (mode === "month") {
    return stripEra(
      start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
    );
  }
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleDateString(
    "ru-RU",
    sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" }
  );
  const endStr = stripEra(
    end.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  );
  return `${startStr} – ${endStr}`;
}

export default function RatingClient({
  currentUserId,
  users,
  transactions,
  showCategories = false,
}) {
  const [tab, setTab] = useState("overall");
  const [periodMode, setPeriodMode] = useState("week");
  const [pickedDate, setPickedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const range = useMemo(() => {
    const d = new Date(pickedDate + "T00:00:00");
    if (periodMode === "week") {
      return { start: startOfWeek(d), end: endOfWeek(d) };
    }
    return { start: startOfMonth(d), end: endOfMonth(d) };
  }, [pickedDate, periodMode]);

  const ranking = useMemo(() => {
    const totals = {};
    users.forEach((u) => {
      totals[u.id] = 0;
    });

    transactions.forEach((t) => {
      if (t.amount_coins <= 0) return;

      if (periodMode !== "all") {
        const created = new Date(t.created_at);
        if (created < range.start || created > range.end) return;
      }

      const cat = classify(t.description);

      if (tab === "overall") {
        totals[t.user_id] = (totals[t.user_id] || 0) + t.amount_coins;
      } else if (tab === cat) {
        totals[t.user_id] = (totals[t.user_id] || 0) + t.amount_coins;
      }
    });

    return users
      .map((u) => ({
        id: u.id,
        name: u.name,
        value: totals[u.id] || 0,
        totalEarned: u.total_earned ?? 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [tab, range, periodMode, users, transactions]);

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
  const myIndex = ranking.findIndex((u) => u.id === currentUserId);
  const podium = ranking.length >= 3;
  const listStart = podium ? 3 : 0;

  // Показываем ли текущий (не прошлый) период — тогда «вперёд» некуда
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
              className={`py-2 rounded-lg text-sm font-semibold transition ${
                tab === t.key
                  ? "bg-acid-400/15 text-acid-400"
                  : "text-gray-400 hover:text-white"
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
            className={`py-2 rounded-lg text-sm font-semibold transition ${
              periodMode === p.key
                ? "bg-acid-400/15 text-acid-400"
                : "text-gray-400 hover:text-white"
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
            className="w-9 h-9 shrink-0 rounded-full bg-dark-800 border border-dark-600 flex items-center justify-center text-gray-400 hover:text-white active:scale-95"
          >
            <Icon name="chevronLeft" className="w-4 h-4" />
          </button>

          <div className="text-center min-w-0">
            <p className="text-sm font-semibold capitalize truncate">
              {formatRange(range.start, range.end, periodMode)}
            </p>
            {!atLatest && (
              <button
                onClick={goToday}
                className="text-xs text-acid-400 hover:underline"
              >
                вернуться к текущей
              </button>
            )}
          </div>

          <button
            onClick={() => shiftPeriod(1)}
            disabled={atLatest}
            aria-label="Позже"
            className="w-9 h-9 shrink-0 rounded-full bg-dark-800 border border-dark-600 flex items-center justify-center text-gray-400 hover:text-white active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
          >
            <Icon name="chevronRight" className="w-4 h-4" />
          </button>
        </div>
      )}

      {podium && (
        <div className="pt-2">
          <div className="flex items-end gap-2">
            {[1, 0, 2].map((idx) => {
              const u = ranking[idx];
              if (!u) return <div key={idx} className="flex-1" />;
              const isMe = u.id === currentUserId;
              const m = MEDALS[idx];
              const prize = prizeCfg?.prizes[idx];
              return (
                <div
                  key={u.id}
                  className="flex-1 flex flex-col items-center min-w-0"
                >
                  <span className="text-2xl leading-none">{m.emoji}</span>
                  <span
                    className={`mt-1 text-xs font-bold truncate max-w-full inline-flex items-center gap-1 ${
                      isMe ? "text-acid-400" : m.name
                    }`}
                  >
                    {u.name}
                    {isMe && (
                      <span className="px-1 rounded bg-acid-400 text-black text-[9px] font-black leading-tight">
                        ВЫ
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-black tabular-nums">
                    {fmt(u.value)}
                  </span>
                  {prize != null && (
                    <span className="text-[11px] font-semibold text-gray-400 tabular-nums">
                      🏆 +{fmt(prize)}
                    </span>
                  )}
                  <div
                    className={`mt-2 w-full rounded-t-xl border bg-gradient-to-b ${m.bar} ${m.h} ${m.glow} flex items-start justify-center pt-1.5`}
                  >
                    <span className={`text-xl font-black ${m.num}`}>
                      {idx + 1}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {prizeCfg && (
            <p className="mt-2 text-xs text-gray-500 text-center">
              Приз {prizeCfg.label} — тем, кто набрал от{" "}
              {prizeCfg.min.toLocaleString("ru-RU")} coins.
            </p>
          )}
        </div>
      )}

      {myIndex >= listStart && (
        <div className="flex items-center justify-between rounded-xl p-3 bg-acid-400/10 border border-acid-400 ring-1 ring-acid-400/30 text-sm">
          <span className="font-bold text-acid-400">Вы&nbsp;#{myIndex + 1}</span>
          <span className="text-gray-300 tabular-nums">
            {myIndex > 0 &&
              `до #${myIndex}: +${fmt(
                ranking[myIndex - 1].value - ranking[myIndex].value
              )} · `}
            {fmt(ranking[myIndex].value)}
          </span>
        </div>
      )}

      <div className="space-y-2">
        {ranking.slice(listStart).map((u, i) => {
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
      </div>
    </div>
  );
}
