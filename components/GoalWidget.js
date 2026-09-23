"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import AnimatedNumber from "@/components/AnimatedNumber";
import Icon from "@/components/Icon";

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
    // Пустой экран — приглашение к действию, а не инструкция из трёх шагов:
    // кнопка ведёт ровно туда, где цель и ставится.
    return (
      <div className="bg-dark-800 border border-dark-700 rounded-2xl p-4 flex items-center gap-3">
        <span className="w-11 h-11 shrink-0 rounded-xl bg-dark-700 flex items-center justify-center text-gray-400">
          <Icon name="target" className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Выбери, на что копишь</p>
          <p className="text-sm text-gray-500 mt-0.5">
            С целью виден прогресс и до неё доходишь быстрее
          </p>
        </div>
        <Link
          href="/mop/shop"
          className="shrink-0 bg-acid-400 text-black font-bold rounded-xl px-4 py-2.5 text-sm active:scale-95 transition"
        >
          Выбрать
        </Link>
      </div>
    );
  }

  const { pct, remaining, achieved } = stats;
  const offset = CIRCUMFERENCE * (1 - animatedPct / 100);
  const ringColorClass = achieved ? "stroke-amber-400" : "stroke-acid-400";
  const textColorClass = achieved ? "text-amber-400" : "text-acid-400";
  const rewardTitle = goal.rewards?.title ?? "награду";
  const fullTitle = goal.variant_label ? `${rewardTitle} — ${goal.variant_label}` : rewardTitle;

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
              <Icon name="check" className="w-7 h-7 text-amber-400" strokeWidth={2.5} />
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
          <p className="font-bold truncate mt-0.5">{fullTitle}</p>
          <p className="text-sm mt-1">
            <span className={achieved ? "text-amber-400" : "text-acid-400"}>
              <AnimatedNumber value={balance} />
            </span>
            <span className="text-gray-500">
              {" "}
              / {goal.target_amount.toLocaleString("ru-RU")} коинов
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
            : `Осталось: ${remaining.toLocaleString("ru-RU")} коинов`}
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
