"use client";

import { useState, useTransition } from "react";
import { assignMopToMe, unassignMop, graduateTrainee } from "@/app/mop/actions";
import Icon from "@/components/Icon";
import { plural } from "@/lib/plural";

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
            className={`inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full border ${
              full
                ? "bg-acid-400/15 text-acid-400 border-acid-400/30"
                : "bg-dark-700 text-gray-500 border-dark-600"
            }`}
          >
            День {d}: {done}/{total}
            {full && <Icon name="check" className="w-3 h-3" strokeWidth={2.5} />}
          </span>
        );
      })}
    </div>
  );
}

const kzt = (n) => `${(Number(n) || 0).toLocaleString("ru-RU")} ₸`;

function lastPaidLabel(days) {
  if (days == null) return "за 4 месяца оплат нет";
  if (days === 0) return "последняя оплата сегодня";
  if (days === 1) return "последняя оплата вчера";
  return `последняя оплата ${days} ${plural(days, "день", "дня", "дней")} назад`;
}

// Неделя без оплат — повод РОПу поговорить с человеком.
const QUIET_DAYS = 7;

export default function TeamManageClient({ mine = [], others = [], monthLabel = "" }) {
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

  function graduate(id, name) {
    if (
      !window.confirm(
        `Допустить ${name}? Стажёр станет МОПом 1 уровня. Отменить нельзя.`
      )
    )
      return;
    setMsg(null);
    start(async () => {
      const res = await graduateTrainee(id);
      setMsg(res?.error || `${name} допущен — теперь МОП`);
    });
  }

  function remove(id, name) {
    if (!window.confirm(`Убрать ${name} из команды?`)) return;
    setMsg(null);
    start(async () => {
      const res = await unassignMop(id);
      setMsg(res?.error || "Убран");
    });
  }

  return (
    <div className="space-y-5">
      {mine.length > 0 && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Выручка команды · {monthLabel}</p>
          <p className="font-display text-3xl font-bold tabular-nums mt-1">
            {kzt(mine.reduce((s, m) => s + (m.month_kzt ?? 0), 0))}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Оплаты есть у {mine.filter((m) => m.month_kzt > 0).length} из {mine.length}
            {(() => {
              const quiet = mine.filter(
                (m) => m.role !== "trainee" && (m.days_since_paid == null || m.days_since_paid >= QUIET_DAYS)
              ).length;
              return quiet > 0 ? ` · неделю без оплат: ${quiet}` : "";
            })()}
          </p>
          {mine.some((m) => m.pending > 0) && (
            <p className="text-xs text-amber-400 mt-2">
              Ждут одобрения: {mine.reduce((s, m) => s + m.pending, 0)}{" "}
              {plural(mine.reduce((s, m) => s + m.pending, 0), "заявка", "заявки", "заявок")}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-gray-400">
          В команде ({mine.length})
        </p>
        {mine.length === 0 && (
          <p className="text-sm text-gray-500">Пока никого.</p>
        )}
        {mine.map((m) => {
          const quiet =
            m.role !== "trainee" && (m.days_since_paid == null || m.days_since_paid >= QUIET_DAYS);
          return (
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
              <p className="text-sm tabular-nums mt-0.5">
                <span className="font-bold">{kzt(m.month_kzt)}</span>
                <span className="text-gray-500"> за месяц</span>
                {m.month_deals > 0 && (
                  <span className="text-gray-500">
                    {" "}· {m.month_deals} {plural(m.month_deals, "оплата", "оплаты", "оплат")}
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500 tabular-nums">
                за неделю: {kzt(m.week_kzt)}
              </p>
              <p className={`text-xs mt-0.5 ${quiet ? "text-amber-400" : "text-gray-600"}`}>
                {lastPaidLabel(m.days_since_paid)}
                {m.pending > 0 && ` · ждёт одобрения: ${m.pending}`}
              </p>
              {m.role === "trainee" && <TraineeProgress ob={m.onboarding} />}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {m.role === "trainee" && (
                <button
                  onClick={() => graduate(m.id, m.name)}
                  disabled={isPending}
                  className="flex items-center gap-1 text-xs font-bold bg-acid-400 text-black rounded-lg px-3 py-1.5"
                >
                  <Icon name="award" className="w-3.5 h-3.5" />
                  Допустить
                </button>
              )}
              <button
                onClick={() => remove(m.id, m.name)}
                disabled={isPending}
                className="text-red-400 text-sm px-2 py-1"
              >
                Убрать
              </button>
            </div>
          </div>
          );
        })}
      </div>

      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3">
        <p className="text-xs text-gray-400">
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
