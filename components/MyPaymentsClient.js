"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import { clientKey, revenueKindText } from "@/lib/revenueKinds";
import { formatPaymentDay } from "@/lib/timezone";
import { plural } from "@/lib/plural";

const NO_NAME = "без ФИО (до обновления)";

const STATUS = {
  approved: { label: "Подтверждена", color: "bg-acid-400/10 text-acid-400" },
  pending: { label: "Ждёт", color: "bg-amber-500/10 text-amber-400" },
  rejected: { label: "Отклонена", color: "bg-red-500/10 text-red-400" },
};

function money(n) {
  return Number(n ?? 0).toLocaleString("ru-RU");
}

function paidAt(r) {
  return r.earned_at || r.created_at;
}

function countText(n) {
  return `${n} ${plural(n, "оплата", "оплаты", "оплат")}`;
}

// Группы по клиентам: считаем всё, кроме отклонённых.
function groupClients(rows) {
  const map = new Map();
  const live = rows
    .filter((r) => r.status !== "rejected")
    .sort((a, b) => new Date(paidAt(a)) - new Date(paidAt(b)));

  for (const r of live) {
    const key = r.client_name ? clientKey(r.client_name) : "";
    if (!map.has(key)) {
      map.set(key, { key, name: r.client_name || NO_NAME, rows: [] });
    }
    map.get(key).rows.push(r);
  }

  return [...map.values()].map((g) => {
    const total = g.rows.reduce((s, r) => s + Number(r.amount_kzt ?? 0), 0);
    const known = g.key !== "";
    const closed = g.rows.some((r) => r.is_final_part || r.pay_kind === "full");
    const hasPart = g.rows.some((r) => r.pay_kind === "part");
    return { ...g, total, closed, waiting: known && hasPart && !closed };
  });
}

export default function MyPaymentsClient({ months, monthKey, monthLabel, rows }) {
  const router = useRouter();
  const [mode, setMode] = useState("payments");

  const summary = useMemo(() => {
    const live = rows.filter((r) => r.status !== "rejected");
    const approved = rows.filter((r) => r.status === "approved");
    return {
      count: live.length,
      approvedSum: approved.reduce((s, r) => s + Number(r.amount_kzt ?? 0), 0),
      pending: rows.filter((r) => r.status === "pending").length,
    };
  }, [rows]);

  const groups = useMemo(() => groupClients(rows), [rows]);
  const waiting = groups.filter((g) => g.waiting);

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs text-gray-500">Месяц</span>
        <select
          value={monthKey}
          onChange={(e) => router.push(`/mop/payments?m=${e.target.value}`)}
          className="mt-1 w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm"
        >
          {months.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-3">
          <p className="text-[11px] text-gray-500">Оплат</p>
          <p className="font-display text-lg tabular-nums">{summary.count}</p>
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 min-w-0">
          <p className="text-[11px] text-gray-500">Подтверждено</p>
          <p className="font-display text-sm tabular-nums break-words">
            {money(summary.approvedSum)} ₸
          </p>
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-3">
          <p className="text-[11px] text-gray-500">На рассмотрении</p>
          <p className="font-display text-lg tabular-nums">{summary.pending}</p>
        </div>
      </div>

      <div className="flex gap-1 bg-dark-800 border border-dark-700 rounded-xl p-1">
        {[
          { key: "payments", label: "По оплатам" },
          { key: "clients", label: "По клиентам" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setMode(t.key)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              mode === t.key ? "bg-acid-400 text-black" : "text-gray-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rows.length === 0 && (
        <EmptyState
          icon="receipt"
          title="В этом месяце оплат нет"
          hint={`За ${monthLabel} ты ещё не записывал оплаты.`}
        />
      )}

      {rows.length > 0 && mode === "payments" && (
        <div className="space-y-2">
          {rows.map((r) => {
            const meta = STATUS[r.status] ?? STATUS.pending;
            const rejected = r.status === "rejected";
            return (
              <div
                key={r.id}
                className={`bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-start justify-between gap-3 ${
                  rejected ? "opacity-50" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className={`font-semibold break-words ${rejected ? "line-through" : ""}`}>
                    {r.client_name || NO_NAME}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatPaymentDay(paidAt(r))}
                    {revenueKindText(r) ? ` · ${revenueKindText(r)}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold tabular-nums">{money(r.amount_kzt)} ₸</p>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rows.length > 0 && mode === "clients" && (
        <div className="space-y-4">
          {waiting.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 px-1">Ждут доплаты</p>
              <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-1.5">
                {waiting.map((g) => (
                  <p key={g.key} className="text-sm flex justify-between gap-3">
                    <span className="min-w-0 break-words">{g.name}</span>
                    <span className="tabular-nums shrink-0 text-gray-400">
                      {money(g.total)} ₸
                    </span>
                  </p>
                ))}
              </div>
              <p className="text-[11px] text-gray-600 px-1">
                Смотрим только оплаты выбранного месяца. Если доплата была в другом месяце, клиент
                тут всё равно покажется.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {groups.map((g) => {
              const parts = g.rows.map((r) => money(r.amount_kzt)).join(" + ");
              return (
                <div
                  key={g.key || "none"}
                  className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-1"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold break-words min-w-0">{g.name}</p>
                    <p className="font-semibold tabular-nums shrink-0">{money(g.total)} ₸</p>
                  </div>
                  <p className="text-sm text-gray-400 break-words">
                    {g.rows.length > 1 ? `${parts} = ${money(g.total)}` : `${parts} ₸`}
                    {g.key !== "" && (g.closed ? ", закрыта" : g.waiting ? ", ждёт доплаты" : "")}
                  </p>
                  <p className="text-xs text-gray-600">{countText(g.rows.length)}</p>
                </div>
              );
            })}
            {groups.length === 0 && (
              <p className="text-sm text-gray-500">Все оплаты месяца отклонены.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
