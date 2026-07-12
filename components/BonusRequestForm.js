"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitBonusRequest } from "@/app/mop/bonus/actions";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";

export default function BonusRequestForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("attendance");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    startTransition(async () => {
      const res = await submitBonusRequest(category, comment);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Заявка отправлена" });
        setComment("");
        setOpen(false);
        router.refresh();
      }
      setTimeout(() => setMessage(null), 3000);
    });
  }

  return (
    <div className="space-y-2">
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

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full bg-dark-800 border border-dark-600 text-white font-bold rounded-2xl py-4 hover:border-acid-400 transition"
        >
          + Отправить достижение
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-dark-800 border border-dark-600 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold">Заявка на бонус</p>
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
              Повод
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white"
            >
              {Object.entries(BONUS_CATEGORIES).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label} — {meta.amount} coins
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Комментарий (необязательно)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white"
              placeholder="Например: скрин чека, номер сделки"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-acid-400 text-black font-bold rounded-lg py-3 hover:bg-acid-500 transition disabled:opacity-50"
          >
            {isPending ? "Отправляем..." : "Отправить на проверку"}
          </button>
        </form>
      )}
    </div>
  );
}
