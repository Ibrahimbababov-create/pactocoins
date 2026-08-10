"use client";

import { useState, useTransition, useRef } from "react";
import {
  broadcastMessage,
  sendTestBroadcast,
  sendToEmployee,
} from "@/app/admin/broadcastActions";

export default function BroadcastClient({ employees = [] }) {
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const fileInputRef = useRef(null);

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function buildFormData() {
    const formData = new FormData();
    formData.append("text", text);
    if (file) formData.append("file", file);
    return formData;
  }

  function handleTest() {
    if (!text.trim() && !file) return;

    setResult(null);
    setMessage(null);

    startTransition(async () => {
      const res = await sendTestBroadcast(buildFormData());
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Тест отправлен тебе в Telegram" });
      }
    });
  }

  function handleSendToEmployee() {
    if (!selectedUserId || (!text.trim() && !file)) return;

    const employee = employees.find((e) => e.id === selectedUserId);
    const confirmed = window.confirm(
      `Отправить это сообщение в Telegram: ${employee?.name ?? "выбранному сотруднику"}?`
    );
    if (!confirmed) return;

    setResult(null);
    setMessage(null);

    startTransition(async () => {
      const formData = buildFormData();
      formData.append("userId", selectedUserId);
      const res = await sendToEmployee(formData);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: `Отправлено: ${res.name}` });
      }
    });
  }

  function handleSend() {
    if (!text.trim() && !file) return;

    const confirmed = window.confirm(
      "Отправить это сообщение всем сотрудникам в Telegram? Отменить после отправки нельзя."
    );
    if (!confirmed) return;

    setResult(null);
    setMessage(null);

    startTransition(async () => {
      const res = await broadcastMessage(buildFormData());
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
            <button type="button" onClick={clearFile} className="text-red-400">
              Убрать
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleTest}
          disabled={isPending || (!text.trim() && !file)}
          className="flex-1 bg-dark-700 text-white font-bold rounded-lg py-3 text-sm disabled:opacity-50"
        >
          {isPending ? "..." : "Тест себе"}
        </button>
        <button
          onClick={handleSend}
          disabled={isPending || (!text.trim() && !file)}
          className="flex-1 bg-acid-400 text-black font-bold rounded-lg py-3 text-sm disabled:opacity-50"
        >
          {isPending ? "Отправляем..." : "Отправить всем"}
        </button>
      </div>

      <div className="flex gap-2 items-center pt-2 border-t border-dark-600">
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="flex-1 bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-acid-400"
        >
          <option value="">Написать конкретному сотруднику...</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSendToEmployee}
          disabled={isPending || !selectedUserId || (!text.trim() && !file)}
          className="flex-1 bg-acid-400 text-black font-bold rounded-lg py-3 text-sm disabled:opacity-50"
        >
          {isPending
            ? "Отправляем..."
            : selectedUserId
            ? `Отправить: ${employees.find((e) => e.id === selectedUserId)?.name ?? ""}`
            : "Отправить сотруднику"}
        </button>
      </div>
    </div>
  );
}
