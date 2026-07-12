"use client";

import { useState } from "react";

const tabs = [
  { key: "overall", label: "Общее" },
  { key: "revenue", label: "Выручка" },
  { key: "bonus", label: "Достижения" },
];

export default function RatingClient({ currentUserId, overall, revenue, bonus }) {
  const [tab, setTab] = useState("overall");

  const data = { overall, revenue, bonus }[tab];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-dark-800 border border-dark-600 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              tab === t.key
                ? "bg-acid-400 text-black"
                : "text-gray-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {data.map((u, i) => {
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
