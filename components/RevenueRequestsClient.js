"use client";

import { useTransition, useState } from "react";
import EmptyState from "@/components/EmptyState";
import {
  approveRevenueRequest,
  rejectRevenueRequest,
  bulkApproveRevenue,
  bulkRejectRevenue,
  cancelApprovedRevenueRequest,
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
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [dateOverrides, setDateOverrides] = useState({});
  const [dateEditingId, setDateEditingId] = useState(null);
  const [comments, setComments] = useState({});
  const [cancelComments, setCancelComments] = useState({});

  const pending = requests.filter(
    (r) => r.status === "pending" && !hiddenIds.has(r.id)
  );
  const processed = requests.filter((r) => r.status !== "pending");

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function hide(ids) {
    setHiddenIds((prev) => new Set([...prev, ...ids]));
  }

  function unhide(ids) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
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
    const earnedAtDate = dateOverrides[id] || undefined;
    const comment = comments[id] || undefined;
    hide([id]);
    startTransition(async () => {
      const res = await approveRevenueRequest(id, earnedAtDate, comment);
      if (res?.error) {
        unhide([id]);
        showMessage(res.error, "error");
      }
    });
  }

  function handleReject(id) {
    const comment = comments[id] || undefined;
    hide([id]);
    startTransition(async () => {
      const res = await rejectRevenueRequest(id, comment);
      if (res?.error) {
        unhide([id]);
        showMessage(res.error, "error");
      }
    });
  }

  function handleCancelApproved(id) {
    if (!window.confirm("Отменить одобренную заявку? Coins спишутся обратно.")) return;
    const comment = cancelComments[id] || undefined;
    startTransition(async () => {
      const res = await cancelApprovedRevenueRequest(id, comment);
      if (res?.error) showMessage(res.error, "error");
      else showMessage("Заявка отменена, coins списаны обратно");
    });
  }

  function handleBulkApprove() {
    const ids = selectedIds;
    hide(ids);
    setSelectedIds([]);
    startTransition(async () => {
      const res = await bulkApproveRevenue(ids);
      if (res?.error) {
        unhide(ids);
        showMessage(res.error, "error");
      } else {
        showMessage(`Подтверждено: ${res.count}`);
      }
    });
  }

  function handleBulkReject() {
    const ids = selectedIds;
    hide(ids);
    setSelectedIds([]);
    startTransition(async () => {
      const res = await bulkRejectRevenue(ids);
      if (res?.error) {
        unhide(ids);
        showMessage(res.error, "error");
      } else {
        showMessage(`Отклонено: ${res.count}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-xl p-3 text-sm text-center ${
            message.type === "error"
              ? "bg-red-500/10 text-red-400"
              : "bg-acid-400/10 text-acid-400"
          }`}
        >
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
          <EmptyState icon="receipt" title="Нет новых заявок" hint="Все заявки на выручку разобраны." />
        )}

        {pending.map((r) => (
          <div
            key={r.id}
            className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-2"
          >
            <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedIds.includes(r.id)}
              onChange={() => toggleSelected(r.id)}
              className="w-5 h-5 shrink-0"
            />

            <div className="flex-1 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {r.users?.name}
                  {r.users?.is_guest && (
                    <span className="text-xs text-gray-500 font-normal"> (гость)</span>
                  )}
                </p>
                <p className="text-sm">
                  {r.amount_kzt.toLocaleString("ru-RU")} ₸ →{" "}
                  <span className="text-acid-400 font-bold">
                    {r.calculated_coins.toLocaleString("ru-RU")} коинов
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
              <div className="flex flex-wrap gap-2 shrink-0">
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

            <div className="pl-8">
              {dateEditingId === r.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateOverrides[r.id] || ""}
                    onChange={(e) =>
                      setDateOverrides((prev) => ({
                        ...prev,
                        [r.id]: e.target.value,
                      }))
                    }
                    className="bg-dark-700 border border-dark-600 rounded-lg px-2 py-1 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setDateEditingId(null)}
                    className="text-xs text-gray-500 hover:text-white"
                  >
                    Ок
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDateEditingId(r.id)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  📅{" "}
                  {dateOverrides[r.id]
                    ? `Засчитать датой: ${new Date(
                        dateOverrides[r.id]
                      ).toLocaleDateString("ru-RU")}`
                    : "Задать другую дату (для рейтинга)"}
                </button>
              )}
              <input
                value={comments[r.id] || ""}
                onChange={(e) =>
                  setComments((prev) => ({ ...prev, [r.id]: e.target.value }))
                }
                placeholder="💬 Комментарий сотруднику (необязательно)"
                className="mt-2 w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-xs text-white"
              />
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
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {r.users?.name}
                    {r.users?.is_guest && (
                      <span className="text-xs text-gray-500 font-normal"> (гость)</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    {r.amount_kzt.toLocaleString("ru-RU")} ₸ ·{" "}
                    {r.calculated_coins.toLocaleString("ru-RU")} коинов
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
              {r.status === "approved" && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={cancelComments[r.id] || ""}
                    onChange={(e) =>
                      setCancelComments((prev) => ({ ...prev, [r.id]: e.target.value }))
                    }
                    placeholder="💬 Причина отмены сотруднику (необязательно)"
                    className="flex-1 min-w-[160px] bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                  <button
                    onClick={() => handleCancelApproved(r.id)}
                    disabled={isPending}
                    className="text-xs bg-red-500/20 text-red-400 rounded-lg px-3 py-1.5 shrink-0 disabled:opacity-50"
                  >
                    Отменить одобрение
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
