"use client";

import { useState, useTransition } from "react";
import { updateNotificationPref } from "@/app/mop/actions";
import { haptic } from "@/lib/haptics";

const ROWS = [
  {
    key: "notify_requests",
    label: "Заявки",
    hint: "Когда одобрили твою заявку на выручку, бонус или покупку",
  },
  {
    key: "notify_shop",
    label: "Магазин",
    hint: "Старт флеш-распродажи, скидки на награды",
  },
  {
    key: "notify_goal",
    label: "Цель",
    hint: "Когда до твоей цели остаётся немного и когда она достигнута",
  },
  {
    key: "notify_rating",
    label: "Рейтинг",
    hint: "Борьба за топ-5: тебя обогнали, ты обогнал, итоги недели",
  },
];

export default function NotificationSettings({ prefs }) {
  const [state, setState] = useState(() => {
    const init = {};
    for (const r of ROWS) init[r.key] = prefs?.[r.key] ?? true;
    return init;
  });
  const [, startTransition] = useTransition();

  function toggle(key) {
    const next = !state[key];
    setState((s) => ({ ...s, [key]: next }));
    haptic.light();
    startTransition(async () => {
      const res = await updateNotificationPref(key, next);
      if (res?.error) {
        // откат при ошибке
        setState((s) => ({ ...s, [key]: !next }));
      }
    });
  }

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-1">
      <p className="text-sm text-gray-500 mb-2">🔔 Уведомления в Telegram</p>

      {ROWS.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => toggle(r.key)}
          className="w-full flex items-start justify-between gap-3 py-2.5 text-left"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium">{r.label}</span>
            <span className="block text-xs text-gray-500 mt-0.5">{r.hint}</span>
          </span>
          <span
            className={`shrink-0 mt-0.5 w-10 h-6 rounded-full p-0.5 transition-colors ${
              state[r.key] ? "bg-acid-400" : "bg-dark-600"
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-black transition-transform ${
                state[r.key] ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </span>
        </button>
      ))}
    </div>
  );
}
