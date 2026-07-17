"use client";

import { useTransition, useState } from "react";
import {
  approveRevenueRequest,
  rejectRevenueRequest,
  bulkApproveRevenue,
  bulkRejectRevenue,
} from "@/app/admin/actions";

const statusLabels = {
  pending: { label: "Ожидает", color: "bg-yellow-500/10 text-yellow-400" },
  approved: { label: "Подтверждено", color: "bg-acid-400/10 text-acid-400" },
  rejected: { label: "Отклонено", color: "bg-red-500/10 text-red-400" },
};

export default function RevenueRequestsClient({ requests }) {
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState([]);
  const [message, setMessage] = useState(null);

  const pending = requests.filter((r) => r.status === "pending");
  const processed = requests.filter((r) => r.status !== "pending");

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function toggleSelected(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === pending.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pending.map((r) => r.id));
    }
  }

  function handleApprove(id) {
    startTransition(() => approveRevenueRequest(id));
  }

  function handleReject(id) {
    startTransition(() => rejectRevenueRequest(id));
  }

  function handleBulkApprove() {
    startTransition(async () => {
      const res = await bulkApproveRevenue(selectedIds);
      showMessage(`Подтверждено: ${res.count}`);
      setSelectedIds([]);
    });
  }

  function handleBulkReject() {
    startTransition(async () => {
      const res = await bulkRejectRevenue(selectedIds);
      showMessage(`Отклонено: ${res.count}`);
      setSelectedIds([]);
    });
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-xl p-3 text-sm text-center bg-acid-400/10 text-acid-400">
          {message.text}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Ожидают подтверждения ({pending.length})
          </p>
          {pending.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="text-xs text-gray-400 hover:text-white"
            >
              {selectedIds.length === pending.length
                ? "Снять выделение"
                : "Выбрать все"}
            </button>
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="flex gap-2 bg-dark-800 border border-acid-400 rounded-xl p-3">
            <span className="text-sm text-gray-300 flex-1 self-center">
              Выбрано: {selectedIds.length}
            </span>
            <button
              onClick={handleBulkApprove}
              disabled={isPending}
              className="bg-acid-400 text-black font-bold rounded-lg px-3 py-2 text-sm"
            >
              Подтвердить выбранные
            </button>
            <button
              onClick={handleBulkReject}
              disabled={isPending}
              className="bg-red-500/20 text-red-400 rounded-lg px-3 py-2 text-sm"
            >
              Отклонить выбранные
            </button>
          </div>
        )}

        {pending.length === 0 && (
          <p className="text-gray-600 text-sm">Нет новых заявок</p>
        )}

        {pending.map((r) => (
          <div
            key={r.id}
            className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center gap-3"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(r.id)}
              onChange={() => toggleSelected(r.id)}
              className="w-5 h-5 shrink-0"
            />

            <div className="flex-1 flex items-center justify-between gap-4">
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
                <p className="text-xs text-gray-600">
                  {new Date(
                    r.reviewed_at || r.created_at
                  ).toLocaleString("ru-RU")}
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
