"use client";

import { useTransition, useState } from "react";
import { updatePurchaseStatus } from "@/app/admin/actions";

const statuses = [
  { value: "pending", label: "Ожидает", color: "bg-yellow-500/10 text-yellow-400" },
  { value: "approved", label: "Одобрено", color: "bg-blue-500/10 text-blue-400" },
  { value: "done", label: "Выполнено", color: "bg-acid-400/10 text-acid-400" },
  { value: "rejected", label: "Отклонено", color: "bg-red-500/10 text-red-400" },
];

export default function PurchaseRequestsClient({ purchases }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  const [localStatuses, setLocalStatuses] = useState({});

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function handleChange(id, newStatus) {
    const previousStatus = localStatuses[id] ?? purchases.find((p) => p.id === id)?.status;

    setLocalStatuses((prev) => ({ ...prev, [id]: newStatus }));

    startTransition(async () => {
      const res = await updatePurchaseStatus(id, newStatus);
      if (res?.error) {
        setLocalStatuses((prev) => ({ ...prev, [id]: previousStatus }));
        showMessage(res.error, "error");
      }
    });
  }

  return (
    <div className="space-y-2">
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

      {purchases.length === 0 && (
        <p className="text-gray-500 text-sm">Заявок пока нет</p>
      )}

      {purchases.map((p) => {
        const currentStatus = localStatuses[p.id] ?? p.status;
        const meta = statuses.find((s) => s.value === currentStatus);
        return (
          <div
            key={p.id}
            className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-semibold">{p.rewards?.title}</p>
              <p className="text-sm text-gray-500">
                {p.users?.name} · {p.price_coins} coins
                {p.kzt_amount ? ` · ${p.kzt_amount.toLocaleString("ru-RU")} ₸` : ""}
              </p>
              <p className="text-xs text-gray-600">
                {new Date(p.created_at).toLocaleString("ru-RU")}
              </p>
            </div>
            <select
              value={currentStatus}
              disabled={isPending}
              onChange={(e) => handleChange(p.id, e.target.value)}
              className={`text-xs rounded-full px-3 py-1.5 border-none ${meta?.color}`}
            >
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
