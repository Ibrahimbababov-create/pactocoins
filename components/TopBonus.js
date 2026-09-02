"use client";

import { useState, useEffect, useTransition } from "react";
import { awardTop3Bonus } from "@/app/admin/ratingExemptActions";

const PLACE = ["🥇 1 место", "🥈 2 место", "🥉 3 место"];

// variants: [{ key, tab, phrase, periodLabel, ranking }] — например «прошлая
// неделя» и «текущая неделя». Админ переключает вкладкой, начисляет по
// выбранному периоду.
export default function TopBonus({
  variants = [],
  title = "🏆 Топ-3",
  min = 2500,
  defaults = ["2000", "1000", "300"],
}) {
  const [isPending, startTransition] = useTransition();
  const [vi, setVi] = useState(0);
  const [amounts, setAmounts] = useState(defaults);
  const [minInput, setMinInput] = useState(String(min));
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const effectiveMin = Math.max(0, Number(minInput) || 0);

  const v = variants[vi] ?? {
    ranking: [],
    phrase: "за период",
    periodLabel: "",
  };
  const ranking = v.ranking ?? [];
  const periodPhrase = v.phrase ?? "за период";
  const periodLabel = v.periodLabel ?? "";

  // При смене периода — свежий текст причины и сброс состояния «начислено».
  useEffect(() => {
    setReason(`Топ-3 ${periodPhrase} (${periodLabel})`);
    setCollapsed(false);
    setMsg(null);
  }, [periodPhrase, periodLabel]);

  const qualified = ranking.filter((r) => r.total >= effectiveMin);
  const belowCount = ranking.length - qualified.length;
  const winners = qualified.slice(0, 3);

  function submit() {
    const items = winners
      .map((w, i) => ({ userId: w.id, name: w.name, amount: Number(amounts[i]) }))
      .filter((x) => x.amount > 0);
    if (!items.length) {
      setMsg({ type: "error", text: "Впиши суммы победителям" });
      return;
    }
    startTransition(async () => {
      const res = await awardTop3Bonus(items, reason.trim(), periodPhrase);
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
        <p className="font-bold">{title}</p>
        <span className="text-xs text-gray-500 shrink-0">{periodLabel}</span>
      </div>

      {variants.length > 1 && (
        <div className="mt-2 inline-flex rounded-lg border border-dark-600 bg-dark-800 p-0.5 text-xs">
          {variants.map((vt, i) => (
            <button
              key={vt.key ?? i}
              onClick={() => setVi(i)}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                i === vi
                  ? "bg-acid-400/15 text-acid-400"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {vt.tab}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
        <span>Порог участия:</span>
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={minInput}
          onChange={(e) => setMinInput(e.target.value)}
          className="w-24 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1 text-sm text-white"
        />
        <span>coins за период</span>
      </div>

      <p className="text-xs text-gray-500 mt-2">
        Не учитывается в рейтинге. Кто набрал меньше порога — в список не
        попадает. При начислении победители получат уведомление в ЛС, и
        объявление уйдёт в общий чат.
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
          За этот период начислений не было.
        </p>
      ) : winners.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          Порог {effectiveMin.toLocaleString("ru-RU")} coins никто не прошёл —
          бонусов нет. Можно снизить порог выше.
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
