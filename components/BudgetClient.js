"use client";

import { useTransition, useState, useRef } from "react";
import { addBudgetTopup, deleteBudgetTopup } from "@/app/admin/budgetActions";

function formatKzt(n) {
  return `${n.toLocaleString("ru-RU")} ₸`;
}

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("ru-RU");
}

function todayLocal() {
  return new Date().toLocaleDateString("en-CA");
}

export default function BudgetClient({ topups, expenses }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  const formRef = useRef(null);

  const totalTopups = topups.reduce((sum, t) => sum + t.amount_kzt, 0);
  const totalSpent = expenses.reduce(
    (sum, e) => sum + (e.actual_kzt_amount || 0),
    0
  );
  const totalCoinsSpent = expenses.reduce(
    (sum, e) => sum + (e.price_coins || 0),
    0
  );
  const remaining = totalTopups - totalSpent;

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function handleSubmit(formData) {
    startTransition(async () => {
      const res = await addBudgetTopup(formData);
      if (res?.error) {
        showMessage(res.error, "error");
      } else {
        formRef.current?.reset();
        showMessage("Пополнение добавлено");
      }
    });
  }

  function handleDelete(id) {
    startTransition(async () => {
      const res = await deleteBudgetTopup(id);
      if (res?.error) showMessage(res.error, "error");
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

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <p className="text-xs text-gray-500">Выдано бюджета</p>
          <p className="text-lg font-bold">{formatKzt(totalTopups)}</p>
        </div>
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <p className="text-xs text-gray-500">Потрачено реально</p>
          <p className="text-lg font-bold">{formatKzt(totalSpent)}</p>
        </div>
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <p className="text-xs text-gray-500">Остаток</p>
          <p
            className={`text-lg font-bold ${
              remaining < 0 ? "text-red-400" : "text-acid-400"
            }`}
          >
            {formatKzt(remaining)}
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Списано coins по этим покупкам: {totalCoinsSpent.toLocaleString("ru-RU")} —
        для сверки с реальными тратами.
      </p>

      <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
        <h2 className="font-semibold mb-3">Добавить пополнение бюджета</h2>
        <form
          ref={formRef}
          action={handleSubmit}
          className="flex flex-wrap gap-2 items-start"
        >
          <input
            type="number"
            name="amount_kzt"
            placeholder="Сумма, ₸"
            required
            min="1"
            className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm w-32"
          />
          <input
            type="date"
            name="given_at"
            defaultValue={todayLocal()}
            required
            className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="text"
            name="note"
            placeholder="Комментарий (необязательно)"
            className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]"
          />
          <button
            type="submit"
            disabled={isPending}
            className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-50"
          >
            Добавить
          </button>
        </form>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Пополнения</h2>
        <div className="space-y-2">
          {topups.length === 0 && (
            <p className="text-gray-500 text-sm">Пополнений пока нет</p>
          )}
          {topups.map((t) => (
            <div
              key={t.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="font-semibold">{formatKzt(t.amount_kzt)}</p>
                {t.note && <p className="text-sm text-gray-500">{t.note}</p>}
                <p className="text-xs text-gray-600">{formatDate(t.given_at)}</p>
              </div>
              <button
                onClick={() => handleDelete(t.id)}
                disabled={isPending}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Расходы по заявкам</h2>
        <div className="space-y-2">
          {expenses.length === 0 && (
            <p className="text-gray-500 text-sm">
              Пока нет заявок с указанной реальной суммой
            </p>
          )}
          {expenses.map((e) => (
            <div
              key={e.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="font-semibold">{e.rewards?.title}</p>
                <p className="text-sm text-gray-500">
                  {e.users?.name} · {e.price_coins} coins
                </p>
              </div>
              <p className="font-bold">{formatKzt(e.actual_kzt_amount)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
