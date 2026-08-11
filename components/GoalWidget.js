"use client";

import { useState, useEffect, useMemo } from "react";

const SIZE = 128;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function computeStats(goal, balance) {
  const remaining = Math.max(goal.target_amount - balance, 0);
  const pct = Math.min(100, Math.round((balance / goal.target_amount) * 100));

  const today = new Date();
  const [y, m, d] = goal.deadline.split("-").map(Number);
  const deadlineUtc = Date.UTC(y, m - 1, d);
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const daysLeft = Math.max(Math.round((deadlineUtc - todayUtc) / 86400000), 1);
  const perDay = remaining > 0 ? Math.ceil(remaining / daysLeft) : 0;

  return { remaining, pct, perDay, achieved: balance >= goal.target_amount };
}

export default function GoalWidget({ goal: initialGoal, balance }) {
  const [goal, setGoal] = useState(initialGoal);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
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
    const targetAmount = Number(amount);
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setError("Укажи сумму больше нуля");
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAmount }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Не получилось сохранить план");
        return;
      }

      setAnimatedPct(0);
      setGoal(data.goal);
      setAmount("");
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
            ? "🎯 Новая цель на оставшиеся дни месяца"
            : "🎯 Поставь план на месяц — до какой суммы хочешь дойти по балансу?"}
        </p>

        {error && (
          <div className="rounded-xl p-3 text-sm text-center bg-red-500/10 text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={submitGoal} className="flex gap-2">
          <input
            type="number"
            min="1"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Например, 15000"
            className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-acid-400"
          />
          <button
            type="submit"
            disabled={isPending}
            className="bg-acid-400 text-black font-bold rounded-lg px-5 py-2.5 text-sm disabled:opacity-50 shrink-0"
          >
            {isPending ? "..." : "Поставить план"}
          </button>
        </form>

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

  const { pct, remaining, perDay, achieved } = stats;
  const offset = CIRCUMFERENCE * (1 - animatedPct / 100);
  const ringColorClass = achieved ? "stroke-amber-400" : "stroke-acid-400";
  const textColorClass = achieved ? "text-amber-400" : "text-acid-400";

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
          {achieved ? "План выполнен" : "План на месяц"}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Цель: {goal.target_amount.toLocaleString("ru-RU")} coins
        </p>

        {achieved ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-xs text-amber-400 font-semibold mt-2"
          >
            Поставить новую цель →
          </button>
        ) : (
          <>
            <p className="text-xs text-gray-500 mt-2">
              Осталось набрать: {remaining.toLocaleString("ru-RU")} coins
            </p>
            <p className="text-xs text-gray-600">
              Нужно в день: ~{perDay.toLocaleString("ru-RU")} coins
            </p>
          </>
        )}
      </div>
    </div>
  );
}
