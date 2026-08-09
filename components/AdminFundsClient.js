"use client";

import { useState, useTransition } from "react";
import { createFund, closeFund } from "@/app/funds/actions";

const statusMeta = {
  active: { label: "Активна", color: "bg-acid-400/10 text-acid-400" },
  completed: { label: "Собрана", color: "bg-blue-500/10 text-blue-400" },
  closed: { label: "Закрыта", color: "bg-gray-500/10 text-gray-400" },
};

export default function AdminFundsClient({ funds, totals }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function handleCreate(e) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createFund(title, description, goal);
      if (res.error) {
        showMessage(res.error, "error");
      } else {
        showMessage("Копилка создана");
        setTitle("");
        setDescription("");
        setGoal("");
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
        onSubmit={handleCreate}
        className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3"
      >
        <p className="text-sm text-gray-500">Новая копилка</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название"
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Описание (необязательно)"
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        />
        <input
          type="number"
          min="1"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Цель, coins"
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        />
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
          const current = totals[fund.id] ?? 0;
          const meta = statusMeta[fund.status];
          return (
            <div
              key={fund.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between gap-3"
            >
              <div>
                <p className="font-semibold">{fund.title}</p>
                <p className="text-xs text-gray-500">
                  {current.toLocaleString("ru-RU")} /{" "}
                  {fund.goal_coins.toLocaleString("ru-RU")} coins
                </p>
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
          );
        })}
      </div>
    </div>
  );
}
