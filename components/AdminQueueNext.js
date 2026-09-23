"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveRevenueRequest, approveBonusRequest, updatePurchaseStatus } from "@/app/admin/actions";
import Icon from "@/components/Icon";

const TYPE_LABEL = {
  revenue: "Выручка",
  bonus: "Бонус",
  purchase: "Покупка",
};

// Первая заявка в очереди целиком, с одной кнопкой на подтверждение —
// не нужно уходить на отдельную страницу ради одного клика.
export default function AdminQueueNext({ item }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  if (!item) {
    return (
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 text-center">
        <Icon name="check" className="w-8 h-8 mx-auto text-acid-400" strokeWidth={2.5} />
        <p className="mt-2 font-semibold">Очередь пуста</p>
        <p className="text-sm text-gray-500 mt-0.5">Все заявки разобраны.</p>
      </div>
    );
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      let res;
      if (item.type === "revenue") {
        res = await approveRevenueRequest(item.id, null, null);
      } else if (item.type === "bonus") {
        res = await approveBonusRequest(item.id, null);
      } else {
        res = await updatePurchaseStatus(item.id, "approved", null);
      }
      if (res?.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-dark-800 border border-acid-400/30 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-acid-400 uppercase tracking-wider">
          Следующая в очереди · {TYPE_LABEL[item.type]}
        </span>
        <span className="text-xs text-gray-500">
          {new Date(item.created_at).toLocaleString("ru-RU", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <div>
        <p className="font-bold text-lg">{item.name ?? "—"}</p>
        <p className="text-gray-300">{item.title}</p>
        {item.sub && <p className="text-sm text-gray-500">{item.sub}</p>}
        {item.comment && (
          <p className="text-sm text-gray-500 mt-1">«{item.comment}»</p>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={handleConfirm}
        disabled={isPending}
        className="w-full bg-acid-400 text-black font-bold rounded-xl py-3 text-sm disabled:opacity-50 active:scale-[0.98] transition"
      >
        {isPending ? "Начисляем..." : "Подтвердить и начислить"}
      </button>
    </div>
  );
}
