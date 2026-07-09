"use client";

import { useState, useTransition } from "react";
import { purchaseReward } from "@/app/mop/shop/actions";

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

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="space-y-3">
          <p className="text-sm text-gray-500">{category}</p>
          <div className="grid grid-cols-2 gap-3">
            {items.map((reward) => {
              const canAfford = balance >= reward.price_coins;
              const isConfirming = confirming === reward.id;

              return (
                <div
                  key={reward.id}
                  className="bg-dark-800 border border-dark-600 rounded-2xl p-4 flex flex-col justify-between"
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
