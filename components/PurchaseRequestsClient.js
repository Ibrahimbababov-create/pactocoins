"use client";

import { useTransition } from "react";
import { updatePurchaseStatus } from "@/app/admin/actions";

const statuses = [
  { value: "pending", label: "Ожидает", color: "bg-yellow-500/10 text-yellow-400" },
  { value: "approved", label: "Одобрено", color: "bg-blue-500/10 text-blue-400" },
  { value: "done", label: "Выполнено", color: "bg-acid-400/10 text-acid-400" },
  { value: "rejected", label: "Отклонено", color: "bg-red-500/10 text-red-400" },
];

export default function PurchaseRequestsClient({ purchases }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(id, newStatus) {
    startTransition(() => updatePurchaseStatus(id, newStatus));
  }

  return (
    <div className="space-y-2">
      {purchases.length === 0 && (
        <p className="text-gray-500 text-sm">Заявок пока нет</p>
      )}

      {purchases.map((p) => {
        const meta = statuses.find((s) => s.value === p.status);
        return (
          <div
            key={p.id}
            className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-semibold">{p.rewards?.title}</p>
              <p className="text-sm text-gray-500">
                {p.users?.name} · {p.price_coins} coins
              </p>
            </div>
            <select
              defaultValue={p.status}
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
