"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import AnimatedNumber from "@/components/AnimatedNumber";

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
      <div className="bg-gradient-to-br from-dark-800 to-dark-700 border border-acid-400/40 rounded-2xl p-5">
        <p className="font-bold text-lg">🎯 Поставь себе цель</p>
        <p className="text-sm text-gray-400 mt-1">
          Копи на конкретную награду — так виден прогресс и до неё быстрее
          доходишь.
        </p>

        <ol className="mt-3 space-y-1.5 text-sm text-gray-300">
          <li>
            <span className="text-acid-400 font-bold">1.</span> Открой{" "}
            <span className="font-semibold">«Магазин»</span> — кнопка{" "}
            <span className="font-semibold">★</span> внизу экрана
          </li>
          <li>
            <span className="text-acid-400 font-bold">2.</span> Выбери награду,
            на которую хочешь копить
          </li>
          <li>
            <span className="text-acid-400 font-bold">3.</span> Нажми на её
            карточке{" "}
            <span className="font-semibold">«🎯 Копить на это»</span>
          </li>
        </ol>

        <Link
          href="/mop/shop"
          className="mt-4 block w-full text-center bg-acid-400 text-black font-bold rounded-xl py-3 text-sm"
        >
          Открыть магазин →
        </Link>

        <p className="text-xs text-gray-600 mt-2 text-center">
          Не обязательно — но с целью интереснее
        </p>
      </div>
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
                <AnimatedNumber value={pct} format={false} />%
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
              <AnimatedNumber value={balance} storageKey="pc-anim-balance" />
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
