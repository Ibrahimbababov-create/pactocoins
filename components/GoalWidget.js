"use client";

import { formatCoins } from "@/lib/plural";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import AnimatedNumber from "@/components/AnimatedNumber";
import Icon from "@/components/Icon";
import { revenueForCoins as tieredKztForCoins } from "@/lib/coinRate";
import { plural } from "@/lib/plural";

const SIZE = 96;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function computeStats(goal, balance) {
  const remaining = Math.max(goal.target_amount - balance, 0);
  const pct = Math.min(100, Math.round((balance / goal.target_amount) * 100));
  return { remaining, pct, achieved: balance >= goal.target_amount };
}

// Сколько выручки нужно на столько коинов — по прогрессивной шкале с
// учётом уже сделанной за месяц выручки и личного множителя.
function revenueForCoins(coins, rate, monthKzt) {
  const kzt = tieredKztForCoins(coins, rate, monthKzt);
  if (kzt >= 1000000) {
    return `${(Math.ceil(kzt / 100000) / 10).toLocaleString("ru-RU")} млн ₸`;
  }
  return `${Math.ceil(kzt / 1000).toLocaleString("ru-RU")} тыс ₸`;
}

// «Примерно за N дней» считаем по темпу текущего месяца. Если выходит
// больше трёх месяцев, цифра не мотивирует, а пугает: тогда не показываем.
function paceText(remaining, monthCoins, dayOfMonth) {
  if (!(monthCoins > 0) || !(dayOfMonth > 0)) return null;
  const perDay = monthCoins / dayOfMonth;
  const days = Math.ceil(remaining / perDay);
  if (!Number.isFinite(days) || days > 90) return null;
  if (days <= 1) return "примерно за день";
  return `примерно за ${days} ${plural(days, "день", "дня", "дней")} в твоём темпе`;
}

export default function GoalWidget({
  goal,
  balance,
  coinRate = 1,
  monthKzt = 0,
  suggestion = null,
  monthCoins = 0,
  dayOfMonth = 0,
  waypoint = null,
}) {
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

  if (!goal && suggestion) {
    const need = suggestion.price_coins - balance;
    return (
      <Link
        href="/mop/shop"
        className="bg-dark-800 border border-dark-700 rounded-2xl p-4 flex items-center gap-4"
      >
        {suggestion.image_url ? (
          <img
            src={suggestion.image_url}
            alt=""
            className="w-14 h-14 rounded-xl object-cover shrink-0"
          />
        ) : (
          <Icon name="bag" className="w-10 h-10 text-gray-500 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500">Ближайшая награда</p>
          <p className="font-semibold truncate">{suggestion.title}</p>
          <p className="text-sm text-gray-400 mt-0.5">
            ещё {formatCoins(need)} ≈ {revenueForCoins(need, coinRate, monthKzt)} продаж
          </p>
        </div>
        <Icon name="chevronRight" className="w-5 h-5 text-gray-600 shrink-0" />
      </Link>
    );
  }

  if (!goal) {
    // Пустой экран — приглашение к действию, а не инструкция из трёх шагов:
    // кнопка ведёт ровно туда, где цель и ставится.
    return (
      <div className="bg-dark-800 border border-dark-700 rounded-2xl p-4 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">На что копишь?</p>
          <p className="text-sm text-gray-500 mt-0.5">
            С целью до награды доходишь быстрее
          </p>
        </div>
        <Link
          href="/mop/shop"
          className="shrink-0 bg-acid-400 text-black font-bold rounded-xl px-5 py-2.5 text-sm active:scale-95 transition"
        >
          Выбрать
        </Link>
      </div>
    );
  }

  const { pct, remaining, achieved } = stats;
  const rewardTitle = goal.rewards?.title ?? "награду";
  const fullTitle = goal.variant_label ? `${rewardTitle} — ${goal.variant_label}` : rewardTitle;
  const pace = achieved ? null : paceText(remaining, monthCoins, dayOfMonth);

  return (
    <Link
      href="/mop/shop"
      className="block bg-dark-800 border border-dark-700 rounded-2xl p-4 active:bg-dark-700 transition"
    >
      <div className="flex items-center gap-3.5">
        {goal.rewards?.image_url ? (
          <img
            src={goal.rewards.image_url}
            alt=""
            className="w-16 h-16 rounded-xl object-cover shrink-0"
          />
        ) : (
          <span className="flex items-center justify-center w-16 h-16 rounded-xl bg-acid-400/10 text-acid-400 shrink-0">
            <Icon name="bag" className="w-7 h-7" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500">
            {achieved ? "Цель достигнута" : "Моя цель"}
          </p>
          <p className="font-bold truncate mt-0.5">{fullTitle}</p>
          <p className="text-sm mt-1 tabular-nums">
            <span className={achieved ? "text-amber-400" : "text-acid-400"}>
              <AnimatedNumber value={balance} />
            </span>
            <span className="text-gray-500"> из {goal.target_amount.toLocaleString("ru-RU")}</span>
          </p>
        </div>
        <Icon name="chevronRight" className="w-4 h-4 text-gray-600 shrink-0" />
      </div>

      <div className="h-2 rounded-full bg-dark-600 overflow-hidden mt-3.5">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-out ${
            achieved ? "bg-amber-400" : "bg-acid-400"
          }`}
          style={{ width: `${Math.max(animatedPct, pct > 0 ? 2 : 0)}%` }}
        />
      </div>

      <p className="text-sm text-gray-300 mt-2.5">
        {achieved
          ? "Можно забирать награду или выбрать новую цель"
          : `Осталось ${formatCoins(remaining)}${pace ? `, ${pace}` : ` ≈ ${revenueForCoins(remaining, coinRate, monthKzt)} продаж`}`}
      </p>
      {!achieved && waypoint && (
        <p className="text-xs text-gray-500 mt-1">
          По дороге: {waypoint.title}, {waypoint.price_coins <= balance ? "уже хватает" : `ещё ${formatCoins(waypoint.price_coins - balance)}`}
        </p>
      )}
    </Link>
  );
}
