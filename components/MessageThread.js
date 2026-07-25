"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sendMessage } from "@/app/mop/messages/actions";

export default function MessageThread({
  currentUserId,
  otherUser,
  initialMessages,
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSend(e) {
    e.preventDefault();
    if (!content.trim()) return;

    setSending(true);
    setError("");
    const res = await sendMessage(otherUser?.id, content, anonymous);
    setSending(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setContent("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/mop/messages" className="text-gray-500 text-sm">
          ←
        </Link>
        <h1 className="text-xl font-bold">{otherUser?.name}</h1>
      </div>

      <div className="space-y-2">
        {initialMessages.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-8">
            Сообщений пока нет
          </p>
        )}

        {initialMessages.map((m) => {
          const isMine = m.sender_id === currentUserId;
          const showAnon = m.is_anonymous && !isMine;

          return (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                isMine
                  ? "ml-auto bg-acid-400 text-black"
                  : "bg-dark-800 border border-dark-600 text-white"
              }`}
            >
              {showAnon && (
                <p className="text-xs opacity-60 mb-0.5">Аноним</p>
              )}
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
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

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            Отправить анонимно
          </label>
          <button
            type="submit"
            disabled={sending}
            className="bg-acid-400 text-black font-bold rounded-lg px-5 py-2 text-sm disabled:opacity-50"
          >
            {sending ? "..." : "Отправить"}
          </button>
        </div>
      </form>
    </div>
  );
}
