"use client";

import { useState, useTransition, useMemo } from "react";
import { purchaseReward, purchaseVariableReward } from "@/app/mop/shop/actions";
import { getEffectivePrice } from "@/lib/rewardPricing";
import { haptic } from "@/lib/haptics";

const GLOW_STYLES = {
  gold: "0 0 24px rgba(250, 204, 21, 0.55)",
  purple: "0 0 24px rgba(168, 85, 247, 0.55)",
  cyan: "0 0 24px rgba(34, 211, 238, 0.55)",
  red: "0 0 24px rgba(248, 113, 113, 0.55)",
};

const GLOW_BORDERS = {
  gold: "border-yellow-400",
  purple: "border-purple-400",
  cyan: "border-cyan-400",
  red: "border-red-400",
};

function slugify(text) {
  return "cat-" + text.replace(/[^a-zA-Zа-яА-Я0-9]+/g, "-").toLowerCase();
}

export default function ShopClient({ grouped, balance }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(null);
  const [message, setMessage] = useState(null);
  const [displayBalance, setDisplayBalance] = useState(balance);
  const [purchasedIds, setPurchasedIds] = useState(new Set());
  const [kztInputs, setKztInputs] = useState({});
  const [confirmingVariable, setConfirmingVariable] = useState(null);
  const [query, setQuery] = useState("");

  // Фильтрация чисто на клиенте — данные уже все на руках, без похода на сервер
  const filteredGrouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return grouped;

    const result = {};
    Object.entries(grouped).forEach(([category, items]) => {
      const matched = items.filter((r) =>
        r.title.toLowerCase().includes(q)
      );
      if (matched.length > 0) result[category] = matched;
    });
    return result;
  }, [grouped, query]);

  function handleBuy(reward) {
    const { effectivePrice } = getEffectivePrice(reward);

    setConfirming(null);
    setDisplayBalance((prev) => prev - effectivePrice);
    setPurchasedIds((prev) => new Set([...prev, reward.id]));

    startTransition(async () => {
      const res = await purchaseReward(reward.id);
      if (res.error) {
        setDisplayBalance((prev) => prev + effectivePrice);
        setPurchasedIds((prev) => {
          const next = new Set(prev);
          next.delete(reward.id);
          return next;
        });
        setMessage({ type: "error", text: res.error });
        haptic.error();
      } else {
        setMessage({ type: "success", text: `Куплено: ${reward.title}` });
        haptic.success();
      }
      setTimeout(() => setMessage(null), 3000);
    });
  }

  function handleBuyVariable(reward) {
    const kzt = Number(kztInputs[reward.id]);
    if (!kzt || kzt <= 0) return;

    const coins = Math.ceil((kzt * reward.rate_coins) / reward.rate_kzt);

    setConfirmingVariable(null);
    setDisplayBalance((prev) => prev - coins);
    setPurchasedIds((prev) => new Set([...prev, reward.id]));

    startTransition(async () => {
      const res = await purchaseVariableReward(reward.id, kzt);
      if (res.error) {
        setDisplayBalance((prev) => prev + coins);
        setPurchasedIds((prev) => {
          const next = new Set(prev);
          next.delete(reward.id);
          return next;
        });
        setMessage({ type: "error", text: res.error });
        haptic.error();
      } else {
        haptic.success();
        setMessage({
          type: "success",
          text: `Куплено: ${reward.title} — ${kzt.toLocaleString("ru-RU")} ₸`,
        });
        setKztInputs((prev) => ({ ...prev, [reward.id]: "" }));
      }
      setTimeout(() => setMessage(null), 3000);
    });
  }

  function handleSetGoal(reward) {
    startTransition(async () => {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId: reward.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Не получилось поставить цель" });
        haptic.error();
      } else {
        setMessage({ type: "success", text: `🎯 Цель поставлена: ${reward.title}` });
        haptic.success();
      }
      setTimeout(() => setMessage(null), 3000);
    });
  }

  function scrollToCategory(category) {
    const el = document.getElementById(slugify(category));
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }

  const categories = Object.keys(filteredGrouped);
  const isSearching = query.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Магазин наград</h1>
        <div className="text-right">
          <p className="text-xs text-gray-500">Баланс</p>
          <p className="text-xl font-black text-acid-400">
            {displayBalance}
          </p>
        </div>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по магазину..."
        className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-acid-400"
      />

      {isSearching && categories.length === 0 && (
        <p className="text-gray-600 text-sm text-center py-4">
          Ничего не нашлось
        </p>
      )}

      {message && (
        <div
          className={`rounded-xl p-3 text-sm text-center ${
            message.type === "error"
              ? "bg-red-500/10 text-red-400"
              : "bg-acid-400/10 text-acid-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Липкая панель быстрого перехода по категориям — бессмысленна при поиске */}
      {!isSearching && (
        <div className="sticky top-0 z-40 -mx-4 px-4 py-2 bg-dark-900/95 backdrop-blur border-b border-dark-600">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => scrollToCategory(category)}
                className="whitespace-nowrap text-xs bg-dark-800 border border-dark-600 rounded-full px-3 py-1.5 text-gray-300 hover:border-acid-400 hover:text-acid-400 transition"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}

      {categories.map((category) => (
        <div
          key={category}
          id={slugify(category)}
          className="space-y-3 scroll-mt-16"
        >
          <p className="text-sm text-gray-500">{category}</p>
          <div className="grid grid-cols-2 gap-3">
            {filteredGrouped[category].map((reward) => {
              const isPurchased = purchasedIds.has(reward.id);
              const isConfirming = confirming === reward.id;

              const kztValue = kztInputs[reward.id] ?? "";
              const computedCoins = reward.is_variable
                ? Math.ceil(
                    (Number(kztValue) * reward.rate_coins) / reward.rate_kzt
                  )
                : 0;
              const { effectivePrice, saleActive } = getEffectivePrice(reward);
              const canAfford = reward.is_variable
                ? Number(kztValue) > 0 && displayBalance >= computedCoins
                : displayBalance >= effectivePrice;
              const isConfirmingVariable = confirmingVariable === reward.id;

              return (
                <div
                  key={reward.id}
                  className={`bg-dark-800 border rounded-2xl p-4 flex flex-col justify-between ${
                    reward.highlight_color
                      ? GLOW_BORDERS[reward.highlight_color]
                      : "border-dark-600"
                  }`}
                  style={
                    reward.highlight_color
                      ? { boxShadow: GLOW_STYLES[reward.highlight_color] }
                      : undefined
                  }
                >
                  <div>
                    {reward.image_url && (
                      <img
                        src={reward.image_url}
                        alt=""
                        className="w-full h-24 object-cover rounded-lg mb-2"
                      />
                    )}
                    <p className="font-semibold text-sm leading-tight">
                      {reward.title}
                    </p>
                    {reward.description && (
                      <p className="text-xs text-gray-500 mt-1">
                        {reward.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-3">
                    {reward.is_variable ? (
                      <>
                        <p className="text-xs text-gray-500 mb-1.5">
                          {reward.rate_coins} coins за каждые{" "}
                          {reward.rate_kzt} ₸
                        </p>

                        {isPurchased ? (
                          <div
                            className="w-full rounded-lg py-2 text-sm font-bold text-center bg-acid-400/10 text-acid-400"
                            style={{ animation: "levelup-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}
                          >
                            ✅ Куплено
                          </div>
                        ) : !isConfirmingVariable ? (
                          <>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={kztValue}
                              onChange={(e) =>
                                setKztInputs((prev) => ({
                                  ...prev,
                                  [reward.id]: e.target.value,
                                }))
                              }
                              placeholder="Сумма в ₸"
                              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-acid-400"
                            />
                            {Number(kztValue) > 0 && (
                              <p className="text-acid-400 text-xs font-bold mt-1">
                                = {computedCoins} coins
                              </p>
                            )}
                            <button
                              disabled={!canAfford}
                              onClick={() => {
                                haptic.light();
                                setConfirmingVariable(reward.id);
                              }}
                              className="w-full mt-2 rounded-lg py-2 text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed bg-acid-400 text-black hover:bg-acid-500 transition"
                            >
                              {Number(kztValue) > 0 && !canAfford
                                ? "Не хватает"
                                : "Купить"}
                            </button>
                          </>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleBuyVariable(reward)}
                              disabled={isPending}
                              className="flex-1 rounded-lg py-2 text-xs font-bold bg-acid-400 text-black"
                            >
                              Точно? ({computedCoins} coins)
                            </button>
                            <button
                              onClick={() => setConfirmingVariable(null)}
                              className="flex-1 rounded-lg py-2 text-xs bg-dark-700 text-gray-400"
                            >
                              Отмена
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {saleActive ? (
                          <p className="flex items-baseline gap-2">
                            <span className="text-gray-500 text-xs line-through">
                              {reward.price_coins}
                            </span>
                            <span className="text-red-400 font-bold">
                              {effectivePrice} coins
                            </span>
                          </p>
                        ) : (
                          <p className="text-acid-400 font-bold">
                            {reward.price_coins} coins
                          </p>
                        )}

                        {isPurchased ? (
                          <div
                            className="w-full mt-2 rounded-lg py-2 text-sm font-bold text-center bg-acid-400/10 text-acid-400"
                            style={{ animation: "levelup-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}
                          >
                            ✅ Куплено
                          </div>
                        ) : !isConfirming ? (
                          <>
                            <button
                              disabled={!canAfford}
                              onClick={() => {
                                haptic.light();
                                setConfirming(reward.id);
                              }}
                              className="w-full mt-2 rounded-lg py-2 text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed bg-acid-400 text-black hover:bg-acid-500 transition"
                            >
                              {canAfford ? "Купить" : "Не хватает"}
                            </button>
                            <button
                              onClick={() => handleSetGoal(reward)}
                              disabled={isPending}
                              className="w-full mt-1.5 rounded-lg py-1.5 text-xs text-gray-400 border border-dark-600 hover:text-acid-400 hover:border-acid-400 transition disabled:opacity-50"
                            >
                              🎯 Копить на это
                            </button>
                          </>
                        ) : (
                          <div className="flex gap-1 mt-2">
                            <button
                              onClick={() => handleBuy(reward)}
                              disabled={isPending}
                              className="flex-1 rounded-lg py-2 text-xs font-bold bg-acid-400 text-black"
                            >
                              Точно?
                            </button>
                            <button
                              onClick={() => setConfirming(null)}
                              className="flex-1 rounded-lg py-2 text-xs bg-dark-700 text-gray-400"
                            >
                              Отмена
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
