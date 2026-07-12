"use client";

import { useTransition, useState } from "react";
import {
  approveBonusRequest,
  rejectBonusRequest,
  awardTopPerformers,
} from "@/app/admin/actions";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";

const statusLabels = {
  pending: { label: "Ожидает", color: "bg-yellow-500/10 text-yellow-400" },
  approved: { label: "Подтверждено", color: "bg-acid-400/10 text-acid-400" },
  rejected: { label: "Отклонено", color: "bg-red-500/10 text-red-400" },
};

export default function BonusRequestsClient({ requests }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function handleApprove(id) {
    startTransition(() => approveBonusRequest(id));
  }

  function handleReject(id) {
    startTransition(() => rejectBonusRequest(id));
  }

  function handleAwardTop(period) {
    startTransition(async () => {
      const res = await awardTopPerformers(period);
      if (res.error) showMessage(res.error, "error");
      else showMessage(`Призовые начислены (${res.winners} чел.)`);
    });
  }

  const pending = requests.filter((r) => r.status === "pending");
  const processed = requests.filter((r) => r.status !== "pending");

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

      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3">
        <p className="text-sm text-gray-500">Призовые ТОПов</p>
        <div className="flex gap-2">
          <button
            onClick={() => handleAwardTop("week")}
            disabled={isPending}
            className="flex-1 bg-acid-400 text-black font-bold rounded-lg py-2.5 text-sm"
          >
            Начислить ТОП недели
          </button>
          <button
            onClick={() => handleAwardTop("month")}
            disabled={isPending}
            className="flex-1 bg-acid-400 text-black font-bold rounded-lg py-2.5 text-sm"
          >
            Начислить ТОП месяца
          </button>
        </div>
        <p className="text-xs text-gray-600">
          Считает по сумме заработанного за период и начисляет призовые
          топ-3. Можно жать хоть каждую неделю/месяц — просто нажимай в
          нужный день.
        </p>
      </div>

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
                {BONUS_CATEGORIES[r.category]?.label ?? r.category} →{" "}
                <span className="text-acid-400 font-bold">
                  {r.amount_coins} coins
                </span>
              </p>
              {r.comment && (
                <p className="text-xs text-gray-500">{r.comment}</p>
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
                  {BONUS_CATEGORIES[r.category]?.label ?? r.category} ·{" "}
                  {r.amount_coins} coins
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
