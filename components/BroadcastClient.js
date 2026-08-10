"use client";

import { useState, useTransition } from "react";
import { broadcastMessage } from "@/app/admin/broadcastActions";

export default function BroadcastClient() {
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState(null);

  function handleSend() {
    if (!text.trim()) return;

    const confirmed = window.confirm(
      "Отправить это сообщение всем сотрудникам в Telegram? Отменить после отправки нельзя."
    );
    if (!confirmed) return;

    setResult(null);
    setMessage(null);

    startTransition(async () => {
      const res = await broadcastMessage(text);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setResult(res);
        setText("");
      }
    });
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-xl p-3 text-sm text-center bg-red-500/10 text-red-400">
          {message.text}
        </div>
      )}

      {result && (
        <div className="rounded-xl p-3 text-sm text-center bg-acid-400/10 text-acid-400">
          Отправлено: {result.sent}, не доставлено: {result.failed}
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Текст сообщения для всех сотрудников..."
        className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-acid-400"
      />

      <button
        onClick={handleSend}
        disabled={isPending || !text.trim()}
        className="w-full bg-acid-400 text-black font-bold rounded-lg py-3 text-sm disabled:opacity-50"
      >
        {isPending ? "Отправляем..." : "Отправить всем"}
      </button>
    </div>
  );
}
