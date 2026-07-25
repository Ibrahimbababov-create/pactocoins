"use client";

import { useState } from "react";
import { sendAnonymousMessage } from "@/app/messages/anonymousActions";

export default function AnonymousMessageForm() {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) return;

    setSending(true);
    const res = await sendAnonymousMessage(content);
    setSending(false);

    if (res.error) {
      setMessage({ type: "error", text: res.error });
    } else {
      setMessage({ type: "success", text: "Отправлено" });
      setContent("");
    }
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
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
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        placeholder="Напиши, что думаешь..."
        className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-acid-400"
      />
      <button
        type="submit"
        disabled={sending}
        className="w-full bg-acid-400 text-black font-bold rounded-lg py-3 text-sm disabled:opacity-50"
      >
        {sending ? "Отправляем..." : "Отправить анонимно"}
      </button>
    </form>
  );
}
