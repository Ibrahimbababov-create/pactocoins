"use client";

import { useTransition, useState } from "react";
import { approveJoinRequest, rejectJoinRequest } from "@/app/admin/joinRequestActions";

const STATUS_META = {
  pending: { label: "Ожидает", color: "bg-yellow-500/10 text-yellow-400" },
  approved: { label: "Принят", color: "bg-acid-400/10 text-acid-400" },
  rejected: { label: "Отклонён", color: "bg-red-500/10 text-red-400" },
};

export default function JoinRequestsClient({ requests }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  const [localStatuses, setLocalStatuses] = useState({});

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function handleApprove(id) {
    startTransition(async () => {
      const res = await approveJoinRequest(id);
      if (res?.error) showMessage(res.error, "error");
      else {
        setLocalStatuses((prev) => ({ ...prev, [id]: "approved" }));
        showMessage("Принят — аккаунт создан");
      }
    });
  }

  function handleReject(id) {
    startTransition(async () => {
      const res = await rejectJoinRequest(id);
      if (res?.error) showMessage(res.error, "error");
      else {
        setLocalStatuses((prev) => ({ ...prev, [id]: "rejected" }));
        showMessage("Отклонён");
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

      {requests.length === 0 && (
        <p className="text-gray-500 text-sm">Заявок пока нет</p>
      )}

      {requests.map((r) => {
        const status = localStatuses[r.id] ?? r.status;
        const meta = STATUS_META[status];
        return (
          <div
            key={r.id}
            className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-semibold">{r.name}</p>
              <p className="text-sm text-gray-500">
                {r.telegram_username ? `@${r.telegram_username}` : `id ${r.telegram_id}`}
              </p>
              <p className="text-xs text-gray-600">
                {new Date(r.created_at).toLocaleString("ru-RU")}
              </p>
            </div>
            {status === "pending" ? (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleApprove(r.id)}
                  disabled={isPending}
                  className="text-xs bg-acid-400 text-black font-bold rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  Принять
                </button>
                <button
                  onClick={() => handleReject(r.id)}
                  disabled={isPending}
                  className="text-xs bg-red-500/20 text-red-400 rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  Отклонить
                </button>
              </div>
            ) : (
              <span className={`text-xs rounded-full px-3 py-1.5 shrink-0 ${meta.color}`}>
                {meta.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
