"use client";

import { useState, useTransition } from "react";
import { purchaseReward } from "@/app/mop/shop/actions";

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

  function handleBuy(reward) {
    startTransition(async () => {
      const res = await purchaseReward(reward.id);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: `Куплено: ${reward.title}` });
      }
      setConfirming(null);
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

  const categories = Object.keys(grouped);

  return (
    <div className="space-y-6">
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

      {/* Липкая панель быстрого перехода по категориям */}
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

      {categories.map((category) => (
        <div
          key={category}
          id={slugify(category)}
          className="space-y-3 scroll-mt-16"
        >
          <p className="text-sm text-gray-500">{category}</p>
          <div className="grid grid-cols-2 gap-3">
            {grouped[category].map((reward) => {
              const canAfford = balance >= reward.price_coins;
              const isConfirming = confirming === reward.id;

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
                    <p className="text-acid-400 font-bold">
                      {reward.price_coins} coins
                    </p>

                    {!isConfirming ? (
                      <button
                        disabled={!canAfford}
                        onClick={() => setConfirming(reward.id)}
                        className="w-full mt-2 rounded-lg py-2 text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed bg-acid-400 text-black hover:bg-acid-500 transition"
                      >
                        {canAfford ? "Купить" : "Не хватает"}
                      </button>
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
