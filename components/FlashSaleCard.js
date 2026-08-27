"use client";

import { useState, useTransition } from "react";
import { purchaseReward } from "@/app/mop/shop/actions";
import { haptic } from "@/lib/haptics";

export default function FlashSaleCard({ reward, balance }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [message, setMessage] = useState(null);
  const [displayBalance, setDisplayBalance] = useState(balance);

  const canAfford = displayBalance >= reward.sale_price_coins;
  const deadline = new Date(reward.sale_ends_at).toLocaleString("ru-RU", {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit",
  });

  function handleBuy() {
    setConfirming(false);
    setDisplayBalance((prev) => prev - reward.sale_price_coins);
    setPurchased(true);

    startTransition(async () => {
      const res = await purchaseReward(reward.id);
      if (res.error) {
        setDisplayBalance((prev) => prev + reward.sale_price_coins);
        setPurchased(false);
        setMessage({ type: "error", text: res.error });
        haptic.error();
        setTimeout(() => setMessage(null), 4000);
      } else {
        haptic.success();
      }
    });
  }

  return (
    <div className="relative bg-dark-800 border-2 border-red-500/60 rounded-3xl p-5 overflow-hidden">
      <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
        🔥 Успей до {deadline}
      </div>

      <div className="flex gap-4 items-center pr-16">
        {reward.image_url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={reward.image_url}
            alt=""
            className="w-24 h-24 rounded-2xl object-cover shrink-0 border border-dark-600"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-lg leading-tight">{reward.title}</p>
          {reward.description && (
            <p className="text-xs text-gray-400 mt-1">{reward.description}</p>
          )}
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-gray-500 text-sm line-through">
              {reward.price_coins}
            </span>
            <span className="text-red-400 font-black text-2xl">
              {reward.sale_price_coins} coins
            </span>
          </div>
        </div>
      </div>

      {message && (
        <div className="mt-3 rounded-xl p-2 text-sm text-center bg-red-500/10 text-red-400">
          {message.text}
        </div>
      )}

      {purchased ? (
        <div
          className="w-full mt-4 rounded-xl py-3 text-sm font-bold text-center bg-acid-400/10 text-acid-400"
          style={{ animation: "levelup-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}
        >
          ✅ Куплено
        </div>
      ) : !confirming ? (
        <button
          disabled={!canAfford}
          onClick={() => setConfirming(true)}
          className="w-full mt-4 rounded-xl py-3 text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed bg-red-500 text-white hover:bg-red-400 transition"
        >
          {canAfford
            ? `Купить за ${reward.sale_price_coins} coins`
            : "Не хватает коинов"}
        </button>
      ) : (
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleBuy}
            disabled={isPending}
            className="flex-1 rounded-xl py-3 text-sm font-bold bg-red-500 text-white"
          >
            Точно?
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 rounded-xl py-3 text-sm bg-dark-700 text-gray-400"
          >
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}
