"use client";

import { useState, useTransition } from "react";
import { awardWeeklyTop3 } from "@/app/admin/ratingExemptActions";

const MIN = 2500;
const PLACE = ["🥇 1 место", "🥈 2 место", "🥉 3 место"];
const DEFAULT_AMOUNTS = ["2000", "1000", "300"];

export default function WeeklyTop3Bonus({ ranking = [], weekLabel = "" }) {
  const [isPending, startTransition] = useTransition();
  const [amounts, setAmounts] = useState(DEFAULT_AMOUNTS);
  const [reason, setReason] = useState(`ТОП-3 за неделю ${weekLabel}`);
  const [msg, setMsg] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const qualified = ranking.filter((r) => r.total >= MIN);
  const belowCount = ranking.length - qualified.length;
  const winners = qualified.slice(0, 3);

  function submit() {
    const items = winners
      .map((w, i) => ({
        userId: w.id,
        name: w.name,
        amount: Number(amounts[i]),
      }))
      .filter((x) => x.amount > 0);
    if (!items.length) {
      setMsg({ type: "error", text: "Впиши суммы победителям" });
      return;
    }
    startTransition(async () => {
      const res = await awardWeeklyTop3(items, reason.trim());
      if (res?.error) setMsg({ type: "error", text: res.error });
      else {
        setMsg({ type: "ok", text: `Начислено: ${res.count}` });
        setCollapsed(true);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-acid-400/25 bg-gradient-to-br from-[#18220b] to-dark-800 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold">🏆 Бонус топ-3 за прошлую неделю</p>
        <span className="text-xs text-gray-500 shrink-0">{weekLabel}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Не учитывается в рейтинге. Порог участия —{" "}
        {MIN.toLocaleString("ru-RU")} coins за неделю. При начислении победители
        получат уведомление в ЛС, и объявление уйдёт в общий чат.
      </p>

      {msg && (
        <p
          className={`mt-3 text-sm ${
            msg.type === "error" ? "text-red-400" : "text-acid-400"
          }`}
        >
          {msg.text}
        </p>
      )}

      {ranking.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          За прошлую неделю начислений не было.
        </p>
      ) : winners.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          Порог {MIN.toLocaleString("ru-RU")} coins никто не прошёл — бонусов нет.
        </p>
      ) : collapsed ? (
        <button
          onClick={() => {
            setCollapsed(false);
            setMsg(null);
          }}
          className="mt-3 text-sm text-acid-400"
        >
          Начислить ещё раз
        </button>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {winners.map((w, i) => (
              <div key={w.id} className="flex items-center gap-3">
                <span className="text-sm w-24 shrink-0 text-gray-400">
                  {PLACE[i]}
                </span>
                <span className="flex-1 min-w-0 truncate font-semibold">
                  {w.name}
                  <span className="text-gray-500 font-normal tabular-nums">
                    {" "}
                    · {w.total.toLocaleString("ru-RU")}
                  </span>
                </span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={amounts[i]}
                  onChange={(e) =>
                    setAmounts((a) =>
                      a.map((x, j) => (j === i ? e.target.value : x))
                    )
                  }
                  placeholder="coins"
                  className="w-24 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-white"
                />
              </div>
            ))}
          </div>

          {(qualified.length < 3 || belowCount > 0) && (
            <p className="mt-2 text-xs text-gray-600">
              {qualified.length < 3 &&
                `Порог прошли только ${qualified.length}. `}
              {belowCount > 0 && `Ниже порога: ${belowCount} чел.`}
            </p>
          )}

          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="За что (пойдёт в историю и в уведомление)"
            className="mt-3 w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white"
          />

          <button
            onClick={submit}
            disabled={isPending}
            className="mt-3 w-full bg-acid-400 text-black font-bold rounded-lg py-2.5 text-sm disabled:opacity-50"
          >
            {isPending ? "Начисляем…" : "Начислить победителям"}
          </button>
        </>
      )}
    </div>
  );
}
