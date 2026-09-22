"use client";

import { useTransition, useState } from "react";
import EmptyState from "@/components/EmptyState";
import {
  approveRewardSuggestion,
  rejectRewardSuggestion,
} from "@/app/admin/rewardSuggestionActions";

const statusLabels = {
  pending: { label: "Ожидает", color: "bg-yellow-500/10 text-yellow-400" },
  approved: { label: "Добавлено", color: "bg-acid-400/10 text-acid-400" },
  rejected: { label: "Отклонено", color: "bg-red-500/10 text-red-400" },
};

export default function RewardSuggestionsClient({ suggestions }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [comments, setComments] = useState({});

  const pending = suggestions.filter(
    (s) => s.status === "pending" && !hiddenIds.has(s.id)
  );
  const processed = suggestions.filter((s) => s.status !== "pending");

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function hide(id) {
    setHiddenIds((prev) => new Set([...prev, id]));
  }

  function unhide(id) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleApprove(id) {
    const comment = comments[id] || undefined;
    hide(id);
    startTransition(async () => {
      const res = await approveRewardSuggestion(id, comment);
      if (res?.error) {
        unhide(id);
        showMessage(res.error, "error");
      } else {
        showMessage("Добавлено в магазин");
      }
    });
  }

  function handleReject(id) {
    const comment = comments[id] || undefined;
    hide(id);
    startTransition(async () => {
      const res = await rejectRewardSuggestion(id, comment);
      if (res?.error) {
        unhide(id);
        showMessage(res.error, "error");
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
        <p className="text-sm text-gray-500">Ожидают решения ({pending.length})</p>

        {pending.length === 0 && (
          <EmptyState icon="bag" title="Нет новых предложений" />
        )}

        {pending.map((s) => (
          <div
            key={s.id}
            className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex flex-col gap-3"
          >
            <div className="flex gap-3">
              {s.image_url && (
                <img
                  src={s.image_url}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {s.title} —{" "}
                  <span className="text-acid-400">{s.price_coins} coins</span>
                </p>
                <p className="text-xs text-gray-500">
                  {s.users?.name}
                  {s.users?.is_guest && " (гость)"}
                </p>
                {s.description && (
                  <p className="text-xs text-gray-500 mt-1">{s.description}</p>
                )}
              </div>
            </div>
            <input
              value={comments[s.id] || ""}
              onChange={(e) =>
                setComments((prev) => ({ ...prev, [s.id]: e.target.value }))
              }
              placeholder="💬 Комментарий сотруднику (необязательно)"
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-xs text-white"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(s.id)}
                disabled={isPending}
                className="flex-1 bg-acid-400 text-black font-bold rounded-lg px-3 py-2 text-sm"
              >
                Добавить в магазин
              </button>
              <button
                onClick={() => handleReject(s.id)}
                disabled={isPending}
                className="flex-1 bg-red-500/20 text-red-400 rounded-lg px-3 py-2 text-sm"
              >
                Отклонить
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-500">История</p>
        {processed.map((s) => {
          const meta = statusLabels[s.status];
          return (
            <div
              key={s.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {s.title} — {s.price_coins} coins
                </p>
                <p className="text-sm text-gray-500">
                  {s.users?.name}
                  {s.users?.is_guest && " (гость)"}
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
