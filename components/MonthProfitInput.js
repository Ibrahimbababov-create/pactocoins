"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMonthProfit } from "@/app/admin/financeActions";

// Одна цифра в месяц: «Прибыль компании» из таблицы финансов.
export default function MonthProfitInput({ monthKey, value }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState(value ? String(Math.round(value)) : "");
  const [msg, setMsg] = useState(null);

  const save = () =>
    start(async () => {
      setMsg(null);
      const res = await setMonthProfit(monthKey, text);
      setMsg(res?.error ? { error: res.error } : { ok: "Сохранено" });
      router.refresh();
    });

  return (
    <div className="mt-3 space-y-1">
      <p className="text-xs text-gray-400">Прибыль компании за месяц из таблицы (столбец «Прибыль компании»)</p>
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="например 2310138"
          className="min-w-0 flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white tabular-nums"
        />
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={save}
          className="shrink-0 bg-acid-400 text-black font-bold rounded-lg px-3 py-2 text-sm disabled:opacity-50"
        >
          Сохранить
        </button>
      </div>
      {msg?.error && <p className="text-xs text-red-400">{msg.error}</p>}
      {msg?.ok && <p className="text-xs text-acid-400">{msg.ok}</p>}
    </div>
  );
}
