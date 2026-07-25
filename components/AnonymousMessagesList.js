"use client";

import { useState, useTransition } from "react";
import { deleteAnonymousMessage } from "@/app/messages/anonymousActions";

export default function AnonymousMessagesList({ messages, canDelete }) {
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState(null);

  function handleDelete(id) {
    const confirmed = window.confirm(
      "Удалить это сообщение? Это нельзя отменить."
    );
    if (!confirmed) return;

    setDeletingId(id);
    startTransition(async () => {
      await deleteAnonymousMessage(id);
      setDeletingId(null);
    });
  }

  if (!messages || messages.length === 0) {
    return <p className="text-gray-600 text-sm">Пока пусто</p>;
  }

  return (
    <>
      {messages.map((m) => (
        <div
          key={m.id}
          className="bg-dark-800 border border-dark-600 rounded-xl p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm whitespace-pre-wrap flex-1">{m.content}</p>
            {canDelete && (
              <button
                onClick={() => handleDelete(m.id)}
                disabled={isPending && deletingId === m.id}
                className="text-red-400 text-xs shrink-0 disabled:opacity-50"
              >
                {isPending && deletingId === m.id ? "..." : "🗑"}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {new Date(m.created_at).toLocaleString("ru-RU")}
          </p>
        </div>
      ))}
    </>
  );
}
