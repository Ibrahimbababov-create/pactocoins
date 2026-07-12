"use client";

import { useState, useMemo } from "react";

const CATEGORY_TABS = [
  { key: "overall", label: "Общее" },
  { key: "revenue", label: "Выручка" },
  { key: "bonus", label: "Достижения" },
];

const PERIODS = [
  { key: "day", label: "За день" },
  { key: "week", label: "За неделю" },
  { key: "month", label: "За месяц" },
];

function classify(desc) {
  if (desc?.startsWith("Выручка подтверждена")) return "revenue";
  if (desc?.startsWith("Бонус:") || desc?.startsWith("ТОП-")) return "bonus";
  return "other";
}

function inPeriod(dateStr, period) {
  const d = new Date(dateStr);
  const now = new Date();

  if (period === "day") {
    return d.toDateString() === now.toDateString();
  }
  if (period === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return d >= weekAgo;
  }
  if (period === "month") {
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    );
  }
  return true;
}

export default function RatingClient({ currentUserId, users, transactions }) {
  const [tab, setTab] = useState("overall");
  const [period, setPeriod] = useState("month");

  const ranking = useMemo(() => {
    const totals = {};
    users.forEach((u) => {
      totals[u.id] = 0;
    });

    transactions.forEach((t) => {
      if (t.amount_coins <= 0) return;
      if (!inPeriod(t.created_at, period)) return;

      const cat = classify(t.description);

      if (tab === "overall") {
        totals[t.user_id] = (totals[t.user_id] || 0) + t.amount_coins;
      } else if (tab === cat) {
        totals[t.user_id] = (totals[t.user_id] || 0) + t.amount_coins;
      }
    });

    return users
      .map((u) => ({ id: u.id, name: u.name, value: totals[u.id] || 0 }))
      .sort((a, b) => b.value - a.value);
  }, [tab, period, users, transactions]);

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

      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white text-sm"
      >
        {PERIODS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>

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
