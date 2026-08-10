"use client";

import { useState, useTransition, useRef } from "react";
import { broadcastMessage } from "@/app/admin/broadcastActions";

export default function BroadcastClient() {
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSend() {
    if (!text.trim() && !file) return;

    const confirmed = window.confirm(
      "Отправить это сообщение всем сотрудникам в Telegram? Отменить после отправки нельзя."
    );
    if (!confirmed) return;

    setResult(null);
    setMessage(null);

    const formData = new FormData();
    formData.append("text", text);
    if (file) formData.append("file", file);

    startTransition(async () => {
      const res = await broadcastMessage(formData);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setResult(res);
        setText("");
        clearFile();
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

      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-dark-700 file:text-white file:text-sm"
        />
        {file && (
          <div className="flex items-center justify-between bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-xs text-gray-400">
            <span>📎 {file.name}</span>
            <button
              type="button"
              onClick={clearFile}
              className="text-red-400"
            >
              Убрать
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleSend}
        disabled={isPending || (!text.trim() && !file)}
        className="w-full bg-acid-400 text-black font-bold rounded-lg py-3 text-sm disabled:opacity-50"
      >
        {isPending ? "Отправляем..." : "Отправить всем"}
      </button>
    </div>
  );
}
