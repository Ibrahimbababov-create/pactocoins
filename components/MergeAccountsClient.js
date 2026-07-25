"use client";

import { useState, useTransition } from "react";
import { mergeAccounts } from "@/app/admin/mergeAccountActions";

export default function MergeAccountsClient({ employees }) {
  const [isPending, startTransition] = useTransition();
  const [oldId, setOldId] = useState("");
  const [newId, setNewId] = useState("");
  const [message, setMessage] = useState(null);

  const oldUser = employees.find((e) => e.id === oldId);
  const newUser = employees.find((e) => e.id === newId);

  function handleMerge() {
    if (!oldId || !newId) return;

    const confirmed = window.confirm(
      `Перенести баланс и историю с "${oldUser?.name}" на "${newUser?.name}"?\n\n` +
        `После этого старый аккаунт "${oldUser?.name}" будет удалён НАВСЕГДА. Отменить нельзя.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const res = await mergeAccounts(oldId, newId);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Готово, аккаунты слиты" });
        setOldId("");
        setNewId("");
      }
      setTimeout(() => setMessage(null), 5000);
    });
  }

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-5 space-y-4">
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

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Старый аккаунт (будет удалён)
        </label>
        <select
          value={oldId}
          onChange={(e) => setOldId(e.target.value)}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2.5 text-white text-sm"
        >
          <option value="">Выбери сотрудника</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} — баланс {e.balance}, всего {e.total_earned}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Новый аккаунт (получит всё)
        </label>
        <select
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2.5 text-white text-sm"
        >
          <option value="">Выбери сотрудника</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} — баланс {e.balance}, всего {e.total_earned}
            </option>
          ))}
        </select>
      </div>

      {oldUser && newUser && oldId !== newId && (
        <div className="bg-dark-700 rounded-lg p-3 text-xs text-gray-400">
          После переноса у <span className="text-white">{newUser.name}</span>{" "}
          станет: баланс{" "}
          <span className="text-acid-400">
            {newUser.balance + oldUser.balance}
          </span>
          , всего заработано{" "}
          <span className="text-acid-400">
            {newUser.total_earned + oldUser.total_earned}
          </span>
        </div>
      )}

      <button
        onClick={handleMerge}
        disabled={isPending || !oldId || !newId || oldId === newId}
        className="w-full bg-red-500/20 text-red-400 font-bold rounded-lg py-3 text-sm disabled:opacity-30"
      >
        {isPending ? "Переносим..." : "Перенести и удалить старый аккаунт"}
      </button>
    </div>
  );
}
