"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function RevenueRequestForm() {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const coins = amount ? Math.floor(Number(amount) / 1000) : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Введите корректную сумму");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: insertError } = await supabase
      .from("revenue_requests")
      .insert({
        user_id: user.id,
        amount_kzt: amountNum,
        calculated_coins: coins,
        comment,
        status: "pending",
      });

    setLoading(false);

    if (insertError) {
      setError("Не удалось отправить заявку");
      return;
    }

    setAmount("");
    setComment("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-acid-400 text-black font-bold rounded-2xl py-4 hover:bg-acid-500 transition"
      >
        + Отправить заявку на выручку
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
            = {coins} coins (1000 ₸ = 1 coin)
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

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-acid-400 text-black font-bold rounded-lg py-3 hover:bg-acid-500 transition disabled:opacity-50"
      >
        {loading ? "Отправляем..." : "Отправить на подтверждение"}
      </button>
    </form>
  );
}
