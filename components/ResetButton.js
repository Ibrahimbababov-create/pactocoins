"use client";

import { useTransition, useState } from "react";
import { resetAllStats } from "@/app/admin/actions";

export default function ResetButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  const [expanded, setExpanded] = useState(false);

  function handleClick() {
    const confirmed = window.confirm(
      "Точно сбросить всё? Обнулит баланс и весь заработок у всех МОПов, удалит историю операций и все заявки. Это нельзя отменить."
    );
    if (!confirmed) return;

    startTransition(async () => {
      const res = await resetAllStats();
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Всё сброшено" });
      }
      setTimeout(() => setMessage(null), 4000);
    });
  }

  return (
    <div className="pt-6 mt-6 border-t border-dark-600">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-gray-600 hover:text-gray-400"
      >
        {expanded ? "▲ Скрыть опасную зону" : "▼ Опасная зона"}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
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
          <button
            onClick={handleClick}
            disabled={isPending}
            className="bg-red-500/20 text-red-400 font-bold rounded-lg px-4 py-2 text-sm hover:bg-red-500/30 transition"
          >
            {isPending ? "Сбрасываем..." : "Сбросить все баллы (тест)"}
          </button>
        </div>
      )}
    </div>
  );
}
