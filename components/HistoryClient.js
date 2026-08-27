"use client";

import { useState } from "react";
import EmptyState from "@/components/EmptyState";

const typeLabels = {
  earn: { label: "Начисление", color: "text-acid-400", sign: "+" },
  manual_add: { label: "Бонус от админа", color: "text-acid-400", sign: "+" },
  spend: { label: "Покупка награды", color: "text-red-400", sign: "" },
  manual_subtract: { label: "Списание", color: "text-red-400", sign: "" },
};

const statusMeta = {
  pending: { label: "Ожидает", color: "bg-yellow-500/10 text-yellow-400" },
  approved: { label: "Подтверждено", color: "bg-acid-400/10 text-acid-400" },
  rejected: { label: "Отклонено", color: "bg-red-500/10 text-red-400" },
};

export default function HistoryClient({ transactions, requests }) {
  const [tab, setTab] = useState("transactions");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-dark-800 border border-dark-600 rounded-xl p-1">
        {[
          { key: "transactions", label: "Начисления" },
          { key: "requests", label: "Мои заявки" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              tab === t.key ? "bg-acid-400 text-black" : "text-gray-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "transactions" ? (
        <div className="space-y-2">
          {transactions.length === 0 && (
            <EmptyState
              icon="history"
              title="Операций пока нет"
              hint="Здесь будут все начисления и списания коинов."
            />
          )}

          {transactions.map((t) => {
            const meta = typeLabels[t.type] ?? {
              label: t.type,
              color: "text-white",
              sign: "",
            };
            const isNegative = t.amount_coins < 0;

            return (
              <div
                key={t.id}
                className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold">{meta.label}</p>
                  {t.description && (
                    <p className="text-xs text-gray-500">{t.description}</p>
                  )}
                  <p className="text-xs text-gray-600">
                    {new Date(t.created_at).toLocaleString("ru-RU")}
                  </p>
                </div>
                <span className={`font-bold ${meta.color}`}>
                  {isNegative ? "" : "+"}
                  {t.amount_coins}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {requests.length === 0 && (
            <EmptyState
              icon="receipt"
              title="Заявок пока нет"
              hint="Отправленные заявки на выручку и бонусы появятся здесь."
            />
          )}

          {requests.map((r) => {
            const meta = statusMeta[r.status] ?? {
              label: r.status,
              color: "bg-gray-500/10 text-gray-400",
            };

            return (
              <div
                key={r.id}
                className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-semibold">{r.label}</p>
                  {r.comment && (
                    <p className="text-xs text-gray-500">{r.comment}</p>
                  )}
                  <p className="text-xs text-gray-600">
                    {new Date(r.created_at).toLocaleString("ru-RU")}
                  </p>
                </div>
                <span
                  className={`text-xs px-3 py-1 rounded-full shrink-0 ${meta.color}`}
                >
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
