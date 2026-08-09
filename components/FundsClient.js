"use client";

import { useState, useTransition } from "react";
import { contributeToFund } from "@/app/funds/actions";

export default function FundsClient({ funds, contributions, balance }) {
  const [isPending, startTransition] = useTransition();
  const [amounts, setAmounts] = useState({});
  const [message, setMessage] = useState(null);
  const [displayBalance, setDisplayBalance] = useState(balance);

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function handleContribute(fund) {
    const amount = Number(amounts[fund.id]);
    if (!amount || amount <= 0) return;
    if (amount > displayBalance) {
      showMessage("Недостаточно coins", "error");
      return;
    }

    setDisplayBalance((prev) => prev - amount);
    setAmounts((prev) => ({ ...prev, [fund.id]: "" }));

    startTransition(async () => {
      const res = await contributeToFund(fund.id, amount);
      if (res.error) {
        setDisplayBalance((prev) => prev + amount);
        showMessage(res.error, "error");
      } else {
        showMessage(`Внесено в «${fund.title}»`);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-right">
        <p className="text-xs text-gray-500">Твой баланс</p>
        <p className="text-xl font-black text-acid-400">{displayBalance}</p>
      </div>

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

      {funds.length === 0 && (
        <p className="text-gray-500 text-sm">Активных копилок пока нет</p>
      )}

      {funds.map((fund) => {
        const fundContributions = contributions.filter(
          (c) => c.fund_id === fund.id
        );
        const current = fundContributions.reduce(
          (sum, c) => sum + c.amount_coins,
          0
        );
        const pct = Math.min(
          100,
          Math.round((current / fund.goal_coins) * 100)
        );

        const byUser = {};
        fundContributions.forEach((c) => {
          const name = c.users?.name ?? "?";
          byUser[name] = (byUser[name] ?? 0) + c.amount_coins;
        });
        const leaderboard = Object.entries(byUser).sort(
          (a, b) => b[1] - a[1]
        );

        return (
          <div
            key={fund.id}
            className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3"
          >
            <div>
              <p className="font-bold text-lg">{fund.title}</p>
              {fund.description && (
                <p className="text-sm text-gray-500">{fund.description}</p>
              )}
            </div>

            <div className="space-y-1">
              <div className="w-full bg-dark-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-acid-400 h-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                {current.toLocaleString("ru-RU")} /{" "}
                {fund.goal_coins.toLocaleString("ru-RU")} coins ({pct}%)
              </p>
            </div>

            {leaderboard.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-dark-600">
                {leaderboard.map(([name, amount]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between text-sm text-gray-300"
                  >
                    <span>{name}</span>
                    <span className="text-acid-400 font-semibold">
                      {amount}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={amounts[fund.id] || ""}
                onChange={(e) =>
                  setAmounts((prev) => ({
                    ...prev,
                    [fund.id]: e.target.value,
                  }))
                }
                placeholder="Сколько внести"
                className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
              />
              <button
                onClick={() => handleContribute(fund)}
                disabled={isPending}
                className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-50"
              >
                Внести
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
