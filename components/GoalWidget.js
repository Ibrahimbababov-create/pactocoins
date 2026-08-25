"use client";

import { useState, useEffect, useMemo } from "react";

const SIZE = 128;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function computeStats(goal, balance) {
  const remaining = Math.max(goal.target_amount - balance, 0);
  const pct = Math.min(100, Math.round((balance / goal.target_amount) * 100));
  return { remaining, pct, achieved: balance >= goal.target_amount };
}

export default function GoalWidget({ goal: initialGoal, balance, rewards }) {
  const [goal, setGoal] = useState(initialGoal);
  const [showForm, setShowForm] = useState(false);
  const [selectedRewardId, setSelectedRewardId] = useState("");
  const [error, setError] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [animatedPct, setAnimatedPct] = useState(0);

  const stats = useMemo(
    () => (goal ? computeStats(goal, balance) : null),
    [goal, balance]
  );

  useEffect(() => {
    if (!stats) return;
    const t = setTimeout(() => setAnimatedPct(stats.pct), 80);
    return () => clearTimeout(t);
  }, [stats?.pct]);

  async function submitGoal(e) {
    e.preventDefault();
    if (!selectedRewardId) {
      setError("Выбери награду");
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId: selectedRewardId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Не получилось сохранить цель");
        return;
      }

      setAnimatedPct(0);
      setGoal(data.goal);
      setSelectedRewardId("");
      setShowForm(false);
    } finally {
      setIsPending(false);
    }
  }

  if (!goal || showForm) {
    return (
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3">
        <p className="text-sm text-gray-400">
          {goal
            ? "🎯 Выбери новую цель"
            : "🎯 На что копишь? Выбери награду из магазина"}
        </p>

        {error && (
          <div className="rounded-xl p-3 text-sm text-center bg-red-500/10 text-red-400">
            {error}
          </div>
        )}

        {rewards.length === 0 ? (
          <p className="text-xs text-gray-500">
            В магазине пока нет наград, на которые можно копить.
          </p>
        ) : (
          <form onSubmit={submitGoal} className="flex gap-2">
            <select
              value={selectedRewardId}
              onChange={(e) => setSelectedRewardId(e.target.value)}
              required
              className="flex-1 min-w-0 bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-acid-400"
            >
              <option value="" disabled>
                Выбери награду
              </option>
              {rewards.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} — {r.effectivePrice.toLocaleString("ru-RU")} coins
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isPending}
              className="bg-acid-400 text-black font-bold rounded-lg px-5 py-2.5 text-sm disabled:opacity-50 shrink-0"
            >
              {isPending ? "..." : "Копить"}
            </button>
          </form>
        )}

        {goal && (
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="text-xs text-gray-500"
          >
            Отмена
          </button>
        )}
      </div>
    );
  }

  const { pct, remaining, achieved } = stats;
  const offset = CIRCUMFERENCE * (1 - animatedPct / 100);
  const ringColorClass = achieved ? "stroke-amber-400" : "stroke-acid-400";
  const textColorClass = achieved ? "text-amber-400" : "text-acid-400";
  const rewardTitle = goal.rewards?.title ?? "награду";

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
            className="stroke-dark-600"
            fill="none"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className={`${ringColorClass} transition-[stroke-dashoffset] duration-1000 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {achieved ? (
            <span className="text-3xl">✅</span>
          ) : (
            <span className={`text-2xl font-black ${textColorClass}`}>
              {pct}%
            </span>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">
          {achieved ? "Цель достигнута!" : "Копишь на"}
        </p>
        <p className="text-sm text-gray-300 truncate mt-0.5">{rewardTitle}</p>
        <p className="text-xs text-gray-500 mt-1">
          {goal.target_amount.toLocaleString("ru-RU")} coins
        </p>

        {achieved ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-xs text-amber-400 font-semibold mt-2"
          >
            Выбрать новую цель →
          </button>
        ) : (
          <>
            <p className="text-xs text-gray-500 mt-2">
              Осталось набрать: {remaining.toLocaleString("ru-RU")} coins
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-xs text-gray-500 mt-1"
            >
              Поменять цель
            </button>
          </>
        )}
      </div>
    </div>
  );
}
