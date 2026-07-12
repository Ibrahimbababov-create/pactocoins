"use client";

import { useTransition } from "react";
import {
  approveRevenueRequest,
  rejectRevenueRequest,
} from "@/app/admin/actions";

const statusLabels = {
  pending: { label: "Ожидает", color: "bg-yellow-500/10 text-yellow-400" },
  approved: { label: "Подтверждено", color: "bg-acid-400/10 text-acid-400" },
  rejected: { label: "Отклонено", color: "bg-red-500/10 text-red-400" },
};

export default function RevenueRequestsClient({ requests }) {
  const [isPending, startTransition] = useTransition();

  function handleApprove(id) {
    startTransition(() => approveRevenueRequest(id));
  }

  function handleReject(id) {
    startTransition(() => rejectRevenueRequest(id));
  }

  const pending = requests.filter((r) => r.status === "pending");
  const processed = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-gray-500">
          Ожидают подтверждения ({pending.length})
        </p>
        {pending.length === 0 && (
          <p className="text-gray-600 text-sm">Нет новых заявок</p>
        )}
        {pending.map((r) => (
          <div
            key={r.id}
            className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-semibold">{r.users?.name}</p>
              <p className="text-sm">
                {r.amount_kzt.toLocaleString("ru-RU")} ₸ →{" "}
                <span className="text-acid-400 font-bold">
                  {r.calculated_coins} coins
                </span>
              </p>
              {r.comment && (
                <p className="text-xs text-gray-500">{r.comment}</p>
              )}
              {r.receipt_confirmed && (
                <p className="text-xs text-acid-400 mt-1">
                  ✅ Чек отправлен в группу
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleApprove(r.id)}
                disabled={isPending}
                className="bg-acid-400 text-black font-bold rounded-lg px-3 py-2 text-sm"
              >
                Подтвердить
              </button>
              <button
                onClick={() => handleReject(r.id)}
                disabled={isPending}
                className="bg-red-500/20 text-red-400 rounded-lg px-3 py-2 text-sm"
              >
                Отклонить
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-500">История</p>
        {processed.map((r) => {
          const meta = statusLabels[r.status];
          return (
            <div
              key={r.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold">{r.users?.name}</p>
                <p className="text-sm text-gray-500">
                  {r.amount_kzt.toLocaleString("ru-RU")} ₸ ·{" "}
                  {r.calculated_coins} coins
                </p>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full ${meta.color}`}>
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
