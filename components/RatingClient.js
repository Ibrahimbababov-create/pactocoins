"use client";

import { useState, useMemo } from "react";

const CATEGORY_TABS = [
  { key: "overall", label: "Общее" },
  { key: "revenue", label: "Выручка" },
  { key: "bonus", label: "Достижения" },
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

function formatRange(start, end, mode) {
  if (mode === "month") {
    return start.toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    });
  }
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleDateString(
    "ru-RU",
    sameMonth ? { day: "numeric" } : { day: "numeric", month: "long" }
  );
  const endStr = end.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${startStr} – ${endStr}`;
}

export default function RatingClient({ currentUserId, users, transactions }) {
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

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-dark-800 border border-dark-600 rounded-xl p-1">
        {CATEGORY_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              tab === t.key ? "bg-acid-400 text-black" : "text-gray-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1 bg-dark-800 border border-dark-600 rounded-xl p-1">
        {[
          { key: "week", label: "Неделя" },
          { key: "month", label: "Месяц" },
          { key: "all", label: "Всё время" },
        ].map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriodMode(p.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              periodMode === p.key ? "bg-acid-400 text-black" : "text-gray-400"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {periodMode !== "all" && (
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftPeriod(-1)}
              className="bg-dark-700 rounded-lg px-3 py-2 text-sm text-gray-300"
            >
              ←
            </button>
            <input
              type="date"
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value)}
              className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
            />
            <button
              onClick={() => shiftPeriod(1)}
              className="bg-dark-700 rounded-lg px-3 py-2 text-sm text-gray-300"
            >
              →
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 capitalize">
              {formatRange(range.start, range.end, periodMode)}
            </p>
            <button onClick={goToday} className="text-xs text-acid-400">
              Сегодня
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {ranking.map((u, i) => {
          const isMe = u.id === currentUserId;
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
              <span className="font-bold">{u.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
