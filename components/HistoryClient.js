"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import { almatyDayKey } from "@/lib/timezone";

const FILTERS = [
  { key: "all", label: "Всё" },
  { key: "earn", label: "Начисления" },
  { key: "purchases", label: "Покупки" },
];

const purchaseStatusMeta = {
  pending: { label: "Ожидает", color: "bg-amber-500/10 text-amber-400" },
  approved: { label: "Одобрено", color: "bg-blue-500/10 text-blue-400" },
  done: { label: "Выполнено", color: "bg-acid-400/10 text-acid-400" },
  rejected: { label: "Отклонено", color: "bg-red-500/10 text-red-400" },
};

function dayLabel(dateStr) {
  const key = almatyDayKey(dateStr);
  const todayKey = almatyDayKey(new Date());
  const yestKey = almatyDayKey(Date.now() - 86400000);
  if (key === todayKey) return "Сегодня";
  if (key === yestKey) return "Вчера";
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

function groupByDay(items) {
  const groups = [];
  let currentKey = null;
  for (const item of items) {
    const key = almatyDayKey(item.created_at);
    if (key !== currentKey) {
      currentKey = key;
      groups.push({ key, label: dayLabel(item.created_at), items: [] });
    }
    groups[groups.length - 1].items.push(item);
  }
  return groups;
}

export default function HistoryClient({ transactions, purchases, pendingCount }) {
  const [tab, setTab] = useState("all");

  const filteredTransactions = useMemo(() => {
    if (tab === "purchases") return [];
    if (tab === "earn") return transactions.filter((t) => t.amount_coins > 0);
    return transactions;
  }, [tab, transactions]);

  const rows = tab === "purchases" ? purchases : filteredTransactions;
  const groups = useMemo(() => groupByDay(rows), [rows]);
  const isEmpty = rows.length === 0;

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span className="text-amber-300 font-semibold">
            {pendingCount === 1
              ? "1 заявка ожидает подтверждения"
              : `${pendingCount} заявки ожидают подтверждения`}
          </span>
        </div>
      )}

      <div className="flex gap-1 bg-dark-800 border border-dark-600 rounded-xl p-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setTab(f.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition active:scale-95 ${
              tab === f.key ? "bg-acid-400 text-black" : "text-gray-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isEmpty && (
        <EmptyState
          icon="history"
          title="Пока пусто"
          hint={
            tab === "purchases"
              ? "Здесь появятся твои покупки в магазине."
              : "Здесь появятся начисления и списания coins."
          }
          action={
            <Link
              href={tab === "purchases" ? "/mop/shop" : "/mop"}
              className="inline-block bg-acid-400 text-black font-bold rounded-xl px-5 py-2.5 text-sm active:scale-95"
            >
              {tab === "purchases" ? "В магазин" : "На главную"}
            </Link>
          }
        />
      )}

      {!isEmpty &&
        groups.map((g) => (
          <div key={g.key} className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider px-1">
              {g.label}
            </p>

            {tab === "purchases"
              ? g.items.map((p) => {
                  const meta = purchaseStatusMeta[p.status] ?? {
                    label: p.status,
                    color: "bg-gray-500/10 text-gray-400",
                  };
                  return (
                    <div
                      key={p.id}
                      className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate">
                          {p.rewards?.title}
                          {p.variant_label && (
                            <span className="text-gray-400 font-normal">
                              {" "}
                              — {p.variant_label}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 tabular-nums">
                          {p.price_coins.toLocaleString("ru-RU")} coins ·{" "}
                          {new Date(p.created_at).toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-3 py-1 rounded-full shrink-0 ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                  );
                })
              : g.items.map((t) => {
                  const isNegative = t.amount_coins < 0;
                  return (
                    <div
                      key={t.id}
                      className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate">
                          {t.description || "Операция"}
                        </p>
                        <p className="text-xs text-gray-600">
                          {new Date(t.created_at).toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span
                        className={`font-bold tabular-nums shrink-0 ${
                          isNegative ? "text-red-400" : "text-acid-400"
                        }`}
                      >
                        {isNegative ? "" : "+"}
                        {t.amount_coins.toLocaleString("ru-RU")}
                      </span>
                    </div>
                  );
                })}
          </div>
        ))}
    </div>
  );
}
