"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sendMessage } from "@/app/messages/actions";

export default function MessageThread({
  currentUserId,
  otherUser,
  initialMessages,
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [localMessages, setLocalMessages] = useState(initialMessages);
  const lastPropCountRef = useRef(initialMessages.length);

  useEffect(() => {
    if (initialMessages.length !== lastPropCountRef.current) {
      lastPropCountRef.current = initialMessages.length;
      setLocalMessages(initialMessages);
    }
  }, [initialMessages]);

  async function handleSend(e) {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      sender_id: currentUserId,
      content: text,
      created_at: new Date().toISOString(),
      _pending: true,
    };

    setLocalMessages((prev) => [...prev, optimisticMessage]);
    setContent("");
    setError("");
    setSending(true);

    const res = await sendMessage(otherUser?.id, text);
    setSending(false);

    if (res.error) {
      setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(res.error);
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/messages" className="text-gray-500 text-sm">
          ←
        </Link>
        <h1 className="text-xl font-bold">{otherUser?.name}</h1>
      </div>

      <div className="space-y-2">
        {localMessages.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-8">
            Сообщений пока нет
          </p>
        )}

        {localMessages.map((m) => {
          const isMine = m.sender_id === currentUserId;

          return (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                isMine
                  ? "ml-auto bg-acid-400 text-black"
                  : "bg-dark-800 border border-dark-600 text-white"
              } ${m._pending ? "opacity-50" : ""}`}
            >
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
              {m._pending && (
                <p className="text-[10px] mt-1 opacity-70">отправляется...</p>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          placeholder="Написать сообщение..."
          className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-acid-400"
        />

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={sending}
          className="w-full bg-acid-400 text-black font-bold rounded-lg py-3 text-sm disabled:opacity-50"
        >
          {sending ? "..." : "Отправить"}
        </button>
      </form>
    </div>
  );
}
