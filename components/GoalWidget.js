"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

const SIZE = 96;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function computeStats(goal, balance) {
  const remaining = Math.max(goal.target_amount - balance, 0);
  const pct = Math.min(100, Math.round((balance / goal.target_amount) * 100));
  return { remaining, pct, achieved: balance >= goal.target_amount };
}

export default function GoalWidget({ goal, balance }) {
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

  if (!goal) {
    return (
      <Link
        href="/mop/shop"
        className="block bg-gradient-to-br from-dark-800 to-dark-700 border border-dark-600 rounded-2xl p-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold">🎯 На что копишь?</p>
            <p className="text-xs text-gray-500 mt-1">
              Выбери награду в магазине — здесь появится прогресс
            </p>
          </div>
          <span className="text-gray-500 text-sm shrink-0">→</span>
        </div>
      </Link>
    );
  }

  const { pct, remaining, achieved } = stats;
  const offset = CIRCUMFERENCE * (1 - animatedPct / 100);
  const ringColorClass = achieved ? "stroke-amber-400" : "stroke-acid-400";
  const textColorClass = achieved ? "text-amber-400" : "text-acid-400";
  const rewardTitle = goal.rewards?.title ?? "награду";

  return (
    <div className="bg-gradient-to-br from-dark-800 to-dark-700 border border-dark-600 rounded-2xl p-4">
      <div className="flex items-center gap-4">
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
              <span className="text-2xl">✅</span>
            ) : (
              <span className={`text-xl font-black ${textColorClass}`}>
                {pct}%
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500">
            {achieved ? "Цель достигнута" : "Копишь на"}
          </p>
          <p className="font-bold truncate mt-0.5">{rewardTitle}</p>
          <p className="text-sm mt-1">
            <span className={achieved ? "text-amber-400" : "text-acid-400"}>
              {balance.toLocaleString("ru-RU")}
            </span>
            <span className="text-gray-500">
              {" "}
              / {goal.target_amount.toLocaleString("ru-RU")} coins
            </span>
          </p>
        </div>

        {goal.rewards?.image_url && (
          <img
            src={goal.rewards.image_url}
            alt=""
            className="w-16 h-16 rounded-xl object-cover shrink-0"
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-600">
        <p className="text-xs text-gray-500">
          {achieved
            ? "Можно выбрать новую цель"
            : `Осталось: ${remaining.toLocaleString("ru-RU")} coins`}
        </p>
        <Link
          href="/mop/shop"
          className={`text-xs font-semibold ${
            achieved ? "text-amber-400" : "text-gray-500"
          }`}
        >
          {achieved ? "Выбрать →" : "Поменять цель →"}
        </Link>
      </div>
    </div>
  );
}
