"use client";

import { useState, useTransition } from "react";
import { updateReminderSettings } from "@/app/mop/actions";

export default function ReminderSettings({ enabled: initialEnabled, time: initialTime }) {
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [time, setTime] = useState(initialTime || "10:00");
  const [message, setMessage] = useState(null);

  function handleSave(e) {
    e.preventDefault();

    if (enabled && !time) {
      setMessage({ type: "error", text: "Укажи время" });
      return;
    }
    setMessage(null);

    startTransition(async () => {
      const formData = new FormData();
      if (enabled) formData.append("enabled", "on");
      formData.append("time", time);

      const res = await updateReminderSettings(formData);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Сохранено" });
        setTimeout(() => setMessage(null), 2000);
      }
    });
  }

  return (
    <form
      onSubmit={handleSave}
      className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">⏰ Напоминания</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span className="text-sm text-gray-300">Включено</span>
        </label>
      </div>

      <p className="text-xs text-gray-600">
        В это время бот напишет тебе в Telegram, если не забыл сегодня
        отправить заявку на выручку или бонус.
      </p>

      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        disabled={!enabled}
        className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-acid-400 disabled:opacity-40"
      />

      {message && (
        <p
          className={`text-xs ${
            message.type === "error" ? "text-red-400" : "text-acid-400"
          }`}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-acid-400 text-black font-bold rounded-lg py-2.5 text-sm disabled:opacity-50"
      >
        {isPending ? "Сохраняем..." : "Сохранить"}
      </button>
    </form>
  );
}
