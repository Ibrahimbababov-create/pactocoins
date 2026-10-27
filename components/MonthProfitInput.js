"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMonthProfit } from "@/app/admin/financeActions";

// Две суммы за месяц из таблицы финансов: сколько прибыли уже есть сейчас
// и (необязательно) сколько ждём к концу месяца.
export default function MonthProfitInput({ monthKey, value, forecast }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState(value ? String(Math.round(value)) : "");
  const [fText, setFText] = useState(forecast ? String(Math.round(forecast)) : "");
  const [msg, setMsg] = useState(null);

  const save = () =>
    start(async () => {
      setMsg(null);
      const res = await setMonthProfit(monthKey, text, fText);
      setMsg(res?.error ? { error: res.error } : { ok: "Сохранено" });
      router.refresh();
    });

  const field = "min-w-0 w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white tabular-nums";

  return (
    <div className="mt-3 space-y-2">
      <div className="space-y-1">
        <p className="text-xs text-gray-400">Сейчас в таблице (столбец «Прибыль компании»)</p>
        <input
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="например 2310138"
          className={field}
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-gray-400">Ожидаю к концу месяца (необязательно)</p>
        <input
          inputMode="numeric"
          value={fText}
          onChange={(e) => setFText(e.target.value)}
          placeholder="пусто: посчитаю по темпу"
          className={field}
        />
      </div>
      <button
        type="button"
        disabled={pending || (!text.trim() && !fText.trim() && !forecast)}
        onClick={save}
        className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-50"
      >
        Сохранить
      </button>
      {msg?.error && <p className="text-xs text-red-400">{msg.error}</p>}
      {msg?.ok && <p className="text-xs text-acid-400">{msg.ok}</p>}
    </div>
  );
}
