"use client";

import { formatCoins } from "@/lib/plural";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitRevenueRequest } from "@/app/mop/revenue/actions";
import { haptic } from "@/lib/haptics";
import { recentDaysAlmaty, PAYMENT_DATE_MAX_DAYS_BACK } from "@/lib/timezone";

// Сегодня первым, дальше назад по дням: «Сегодня, 05.10», «Вчера, 04.10», «сб, 03.10»…
function paymentDayOptions() {
  return recentDaysAlmaty(PAYMENT_DATE_MAX_DAYS_BACK + 1)
    .reverse()
    .map((d, i) => ({
      key: d.key,
      label:
        i === 0 ? `Сегодня, ${d.label}` : i === 1 ? `Вчера, ${d.label}` : `${d.weekday}, ${d.label}`,
    }));
}

export default function RevenueRequestForm({ open, onOpenChange }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setOpen = onOpenChange;
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);
  const [error, setError] = useState("");
  // Пусто = сегодня. Список дат строим при открытии формы, а не при
  // рендере сервера, — чтобы «сегодня» было по часам на момент заявки.
  const [paymentDay, setPaymentDay] = useState("");
  const [dayOptions, setDayOptions] = useState([]);

  const coins = amount ? Math.floor(Number(amount) / 1000) : 0;

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Введите корректную сумму");
      haptic.error();
      return;
    }

    if (!receiptConfirmed) {
      setError("Подтверди, что отправил чек в группу");
      haptic.error();
      return;
    }

    startTransition(async () => {
      const res = await submitRevenueRequest(
        amountNum,
        comment,
        receiptConfirmed,
        paymentDay || undefined
      );

      if (res.error) {
        setError(res.error);
        haptic.error();
        return;
      }

      haptic.success();

      setAmount("");
      setComment("");
      setReceiptConfirmed(false);
      setPaymentDay("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          haptic.light();
          setDayOptions(paymentDayOptions());
          setOpen(true);
        }}
        className="flex-1 bg-acid-400 text-black font-bold rounded-2xl py-4 active:scale-[0.98] transition"
      >
        Записать выручку
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-dark-800 border border-dark-600 rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <p className="font-semibold">Новая заявка</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-gray-500 text-sm"
        >
          Отмена
        </button>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Сумма выручки, ₸
        </label>
        <input
          type="number"
          required
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-acid-400"
          placeholder="560000"
        />
        {amount > 0 && (
          <p className="text-xs text-acid-400 mt-1">
            = {formatCoins(coins)} (1000 ₸ = 1 коин)
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Дата оплаты
        </label>
        <select
          value={paymentDay}
          onChange={(e) => setPaymentDay(e.target.value)}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-acid-400"
        >
          {dayOptions.map((d, i) => (
            <option key={d.key} value={i === 0 ? "" : d.key}>
              {d.label}
            </option>
          ))}
        </select>
        {paymentDay && (
          <p className="text-xs text-gray-500 mt-1">
            В рейтинге оплата встанет на этот день
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Комментарий
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-acid-400"
          placeholder="Клиент, номер сделки и т.д."
        />
      </div>

      <label className="flex items-start gap-3 bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={receiptConfirmed}
          onChange={(e) => setReceiptConfirmed(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-sm text-gray-300">
          Я отправил чек в Telegram-группу
        </span>
      </label>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-acid-400 text-black font-bold rounded-lg py-3 hover:bg-acid-500 transition disabled:opacity-50"
      >
        {isPending ? "Отправляем..." : "Отправить на подтверждение"}
      </button>
    </form>
  );
}
