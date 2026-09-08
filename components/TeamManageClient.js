"use client";

import { useState, useTransition } from "react";
import { assignMopToMe, unassignMop } from "@/app/mop/actions";

function TraineeProgress({ ob }) {
  if (!ob) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {[1, 2, 3].map((d) => {
        const done = ob.done?.[d] ?? 0;
        const total = ob.total?.[d] ?? 0;
        const full = total > 0 && done >= total;
        return (
          <span
            key={d}
            className={`text-[11px] px-2 py-0.5 rounded-full border ${
              full
                ? "bg-acid-400/15 text-acid-400 border-acid-400/30"
                : "bg-dark-700 text-gray-500 border-dark-600"
            }`}
          >
            День {d}: {done}/{total}
            {full ? " ✓" : ""}
          </span>
        );
      })}
    </div>
  );
}

export default function TeamManageClient({ mine = [], others = [] }) {
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState(null);
  const [pick, setPick] = useState("");

  function add() {
    if (!pick) return;
    setMsg(null);
    start(async () => {
      const res = await assignMopToMe(pick);
      setMsg(res?.error || "Добавлен");
      if (!res?.error) setPick("");
    });
  }

  function remove(id) {
    setMsg(null);
    start(async () => {
      const res = await unassignMop(id);
      setMsg(res?.error || "Убран");
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs text-gray-400 uppercase tracking-wider">
          В команде ({mine.length})
        </p>
        {mine.length === 0 && (
          <p className="text-sm text-gray-500">Пока никого.</p>
        )}
        {mine.map((m) => (
          <div
            key={m.id}
            className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="font-semibold truncate">
                {m.name}
                {m.role === "trainee" && (
                  <span className="ml-1.5 text-[10px] font-bold bg-sky-500/15 text-sky-300 px-1.5 py-0.5 rounded">
                    стажёр
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500 tabular-nums">
                за месяц: {(m.month_earned ?? 0).toLocaleString("ru-RU")} ·
                всего: {(m.total_earned ?? 0).toLocaleString("ru-RU")}
              </p>
              {m.role === "trainee" && <TraineeProgress ob={m.onboarding} />}
            </div>
            <button
              onClick={() => remove(m.id)}
              disabled={isPending}
              className="text-red-400 text-sm shrink-0 px-2 py-1"
            >
              Убрать
            </button>
          </div>
        ))}
      </div>

      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3">
        <p className="text-xs text-gray-400 uppercase tracking-wider">
          Добавить в команду
        </p>
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        >
          <option value="">Выбери МОПа…</option>
          {others.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.rop_id ? " (уже у другого РОПа)" : ""}
            </option>
          ))}
        </select>
        <button
          onClick={add}
          disabled={isPending || !pick}
          className="w-full bg-acid-400 text-black font-bold rounded-lg py-2 text-sm disabled:opacity-50"
        >
          Добавить
        </button>
      </div>

      {msg && <p className="text-sm text-acid-400">{msg}</p>}
    </div>
  );
}
