"use client";

import { useState, useTransition } from "react";
import {
  createMop,
  updateMop,
  manualAdjustBalance,
  resetUserStats,
} from "@/app/admin/actions";

export default function EmployeesClient({ users }) {
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [adjustingId, setAdjustingId] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [message, setMessage] = useState(null);

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }

  function handleCreate(formData) {
    startTransition(async () => {
      const res = await createMop(formData);
      if (res.error) showMessage(res.error, "error");
      else {
        showMessage("Сотрудник создан");
        setShowCreate(false);
      }
    });
  }

  function handleUpdate(userId, formData) {
    startTransition(async () => {
      const res = await updateMop(userId, formData);
      if (res.error) showMessage(res.error, "error");
      else {
        showMessage("Обновлено");
        setEditingId(null);
      }
    });
  }

  function handleAdjust(userId, sign) {
    const amount = Number(adjustAmount) * sign;
    if (!amount) return;

    startTransition(async () => {
      const res = await manualAdjustBalance(userId, amount, adjustReason);
      if (res.error) showMessage(res.error, "error");
      else {
        showMessage("Баланс обновлён");
        setAdjustingId(null);
        setAdjustAmount("");
        setAdjustReason("");
      }
    });
  }

  function handleReset(userId, name) {
    const confirmed = window.confirm(
      `Сбросить все данные ${name}? Обнулит баланс, заработок и удалит его историю. Отменить нельзя.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const res = await resetUserStats(userId);
      if (res.error) showMessage(res.error, "error");
      else showMessage("Данные сброшены");
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

      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="bg-acid-400 text-black font-bold rounded-xl px-4 py-2 text-sm"
        >
          + Добавить сотрудника
        </button>
      ) : (
        <form
          action={handleCreate}
          className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold">Новый сотрудник</p>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-gray-500 text-sm"
            >
              Отмена
            </button>
          </div>
          <input
            name="name"
            required
            placeholder="Имя"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
          />
          <input
            name="password"
            type="text"
            required
            placeholder="Пароль (придумай сам)"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
          />
          <select
            name="role"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
          >
            <option value="mop">МОП</option>
            <option value="admin">Админ</option>
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-acid-400 text-black font-bold rounded-lg py-2.5"
          >
            Создать
          </button>
        </form>
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-3"
          >
            {editingId === u.id ? (
              <form
                action={(fd) => handleUpdate(u.id, fd)}
                className="space-y-2"
              >
                <input
                  name="name"
                  defaultValue={u.name}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
                <select
                  name="role"
                  defaultValue={u.role}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="mop">МОП</option>
                  <option value="admin">Админ</option>
                </select>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-acid-400 text-black font-bold rounded-lg py-2 text-sm"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex-1 bg-dark-700 text-gray-400 rounded-lg py-2 text-sm"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {u.name}{" "}
                    <span className="text-xs text-gray-500">
                      ({u.role === "admin" ? "админ" : "МОП"})
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Баланс: <span className="text-acid-400">{u.balance}</span>{" "}
                    · всего {u.total_earned} · месяц {u.month_earned}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingId(u.id)}
                    className="text-xs bg-dark-700 rounded-lg px-3 py-1.5"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() =>
                      setAdjustingId(adjustingId === u.id ? null : u.id)
                    }
                    className="text-xs bg-dark-700 rounded-lg px-3 py-1.5"
                  >
                    Баланс
                  </button>
                  <button
                    onClick={() => handleReset(u.id, u.name)}
                    disabled={isPending}
                    className="text-xs bg-red-500/20 text-red-400 rounded-lg px-3 py-1.5"
                  >
                    Сбросить
                  </button>
                </div>
              </div>
            )}

            {adjustingId === u.id && (
              <div className="border-t border-dark-600 pt-3 space-y-2">
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="Количество coins"
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
                <input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Причина"
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAdjust(u.id, 1)}
                    disabled={isPending}
                    className="flex-1 bg-acid-400 text-black font-bold rounded-lg py-2 text-sm"
                  >
                    + Начислить
                  </button>
                  <button
                    onClick={() => handleAdjust(u.id, -1)}
                    disabled={isPending}
                    className="flex-1 bg-red-500/20 text-red-400 font-bold rounded-lg py-2 text-sm"
                  >
                    − Списать
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
