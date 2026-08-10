"use client";

import { useState, useTransition, useRef } from "react";
import { createFund, closeFund, refundContribution } from "@/app/funds/actions";

const statusMeta = {
  active: { label: "Активна", color: "bg-acid-400/10 text-acid-400" },
  completed: { label: "Собрана", color: "bg-blue-500/10 text-blue-400" },
  closed: { label: "Закрыта", color: "bg-gray-500/10 text-gray-400" },
};

export default function AdminFundsClient({ funds, contributions }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  const formRef = useRef(null);

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function handleCreate(formData) {
    startTransition(async () => {
      const res = await createFund(formData);
      if (res.error) {
        showMessage(res.error, "error");
      } else {
        showMessage("Копилка создана");
        formRef.current?.reset();
      }
    });
  }

  function handleClose(fundId, fundTitle) {
    const confirmed = window.confirm(`Закрыть копилку «${fundTitle}»?`);
    if (!confirmed) return;

    startTransition(async () => {
      const res = await closeFund(fundId);
      if (res.error) showMessage(res.error, "error");
      else showMessage("Копилка закрыта");
    });
  }

  function handleRefund(fundId, userId, name) {
    const confirmed = window.confirm(
      `Тихо вернуть ${name} всё, что он внёс в эту копилку? Никто больше этого не увидит.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const res = await refundContribution(fundId, userId);
      if (res.error) showMessage(res.error, "error");
      else showMessage(`Возвращено: ${res.amount}`);
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

      <form
        ref={formRef}
        action={handleCreate}
        className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3"
      >
        <p className="text-sm text-gray-500">Новая копилка</p>
        <input
          name="title"
          placeholder="Название"
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        />
        <input
          name="description"
          placeholder="Описание (необязательно)"
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        />
        <input
          name="goalCoins"
          type="number"
          min="1"
          placeholder="Цель, coins"
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        />
        <label className="block space-y-1">
          <span className="text-xs text-gray-500">Фото (необязательно)</span>
          <input
            name="photo"
            type="file"
            accept="image/*"
            className="w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-dark-700 file:text-white file:text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-acid-400 text-black font-bold rounded-lg py-2.5 text-sm disabled:opacity-50"
        >
          Создать
        </button>
      </form>

      <div className="space-y-2">
        {funds.length === 0 && (
          <p className="text-gray-600 text-sm">Копилок пока нет</p>
        )}
        {funds.map((fund) => {
          const fundContributions = contributions.filter(
            (c) => c.fund_id === fund.id
          );
          const current = fundContributions.reduce(
            (sum, c) => sum + c.amount_coins,
            0
          );
          const meta = statusMeta[fund.status];

          const byUser = {};
          fundContributions.forEach((c) => {
            const key = c.user_id;
            if (!byUser[key]) {
              byUser[key] = { name: c.users?.name ?? "?", amount: 0 };
            }
            byUser[key].amount += c.amount_coins;
          });
          const leaderboard = Object.entries(byUser).sort(
            (a, b) => b[1].amount - a[1].amount
          );

          return (
            <div
              key={fund.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {fund.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={fund.image_url}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{fund.title}</p>
                    <p className="text-xs text-gray-500">
                      {current.toLocaleString("ru-RU")} /{" "}
                      {fund.goal_coins.toLocaleString("ru-RU")} coins
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs px-3 py-1 rounded-full ${meta.color}`}
                  >
                    {meta.label}
                  </span>
                  {fund.status === "active" && (
                    <button
                      onClick={() => handleClose(fund.id, fund.title)}
                      disabled={isPending}
                      className="text-xs bg-red-500/20 text-red-400 rounded-lg px-3 py-1.5"
                    >
                      Закрыть
                    </button>
                  )}
                </div>
              </div>

              {leaderboard.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-dark-600">
                  {leaderboard.map(([userId, u]) => (
                    <div
                      key={userId}
                      className="flex items-center justify-between text-xs text-gray-400 gap-2"
                    >
                      <span>{u.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-acid-400 font-semibold">
                          {u.amount}
                        </span>
                        <button
                          onClick={() =>
                            handleRefund(fund.id, userId, u.name)
                          }
                          disabled={isPending}
                          className="text-gray-500 hover:text-red-400"
                        >
                          Вернуть
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
