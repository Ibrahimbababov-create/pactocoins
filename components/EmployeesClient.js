"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import {
  createMop,
  updateMop,
  manualAdjustBalance,
  resetUserStats,
  offboardEmployee,
  reinstateEmployee,
} from "@/app/admin/actions";

const GROUPS = [
  { key: "mop", label: "МОПы" },
  { key: "rop", label: "РОПы" },
  { key: "observer", label: "Наблюдатели" },
  { key: "admin", label: "Админы" },
  { key: "test", label: "🤖 Тестовые (Claude)" },
  { key: "offboarded", label: "Уволенные" },
];

function groupOf(u) {
  if (u.email?.endsWith(".test@pactocoins.local")) return "test";
  if (!u.is_active) return "offboarded";
  if (u.role === "rop") return "rop";
  if (u.role === "observer") return "observer";
  if (u.role === "admin") return "admin";
  return "mop";
}

export default function EmployeesClient({ users }) {
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [adjustingId, setAdjustingId] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [message, setMessage] = useState(null);
  const [openGroups, setOpenGroups] = useState(() => new Set(["mop", "rop"]));

  const grouped = useMemo(() => {
    const g = Object.fromEntries(GROUPS.map((x) => [x.key, []]));
    for (const u of users) g[groupOf(u)].push(u);
    return g;
  }, [users]);

  function toggleGroup(key) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

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

  function handleOffboard(userId, name) {
    const confirmed = window.confirm(
      `Уволить ${name}? Баланс обнулится, он пропадёт из рейтинга и списка активных. История (заявки, транзакции) сохранится — при необходимости можно восстановить.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const res = await offboardEmployee(userId);
      if (res.error) showMessage(res.error, "error");
      else showMessage(`${name} уволен`);
    });
  }

  function handleReinstate(userId, name) {
    startTransition(async () => {
      const res = await reinstateEmployee(userId);
      if (res.error) showMessage(res.error, "error");
      else showMessage(`${name} восстановлен`);
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
            <option value="rop">РОП</option>
            <option value="admin">Админ</option>
            <option value="observer">Наблюдатель</option>
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

      {GROUPS.map((g) => {
        const list = grouped[g.key];
        if (!list.length) return null;
        const isOpen = openGroups.has(g.key);
        return (
          <div
            key={g.key}
            className="border border-dark-600 rounded-2xl overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleGroup(g.key)}
              className="w-full flex items-center justify-between px-4 py-3 bg-dark-800 hover:bg-dark-700 transition"
            >
              <span className="font-semibold text-sm">
                {g.label}{" "}
                <span className="text-gray-500 font-normal">· {list.length}</span>
              </span>
              <Icon
                name="chevronRight"
                className={`w-4 h-4 text-gray-500 transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
              />
            </button>
            {isOpen && (
              <div className="p-2 space-y-2 bg-dark-900/40">
                {list.map((u) => (
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
                  <option value="rop">РОП</option>
                  <option value="admin">Админ</option>
                  <option value="observer">Наблюдатель</option>
                </select>
                <label className="block space-y-1">
                  <span className="text-xs text-gray-500">
                    Множитель коинов (для тимлидов, 1 — обычный МОП)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    name="coin_rate_multiplier"
                    defaultValue={u.coin_rate_multiplier ?? 1}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-gray-500">
                    День рождения
                  </span>
                  <input
                    type="date"
                    name="birthday"
                    defaultValue={u.birthday ?? ""}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </label>
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {u.name}{" "}
                    <span className="text-xs text-gray-500">
                      ({u.role === "admin" ? "админ" : u.role === "observer" ? "наблюдатель" : u.role === "rop" ? "РОП" : "МОП"})
                      {Number(u.coin_rate_multiplier) !== 1 && (
                        <span className="text-acid-400"> · x{u.coin_rate_multiplier}</span>
                      )}
                    </span>
                    {!u.is_active && (
                      <span className="ml-2 text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">
                        уволен
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                  <p className="text-xs text-gray-500 mt-1 tabular-nums">
                    Баланс:{" "}
                    <span className="text-acid-400">
                      {u.balance.toLocaleString("ru-RU")}
                    </span>{" "}
                    · всего {u.total_earned.toLocaleString("ru-RU")} · месяц{" "}
                    {u.month_earned.toLocaleString("ru-RU")}
                  </p>
                  {u.goal ? (
                    <span className="inline-block mt-1.5 text-xs bg-acid-400/10 text-acid-400 px-2 py-0.5 rounded-full">
                      🎯 {u.goal.rewards?.title ?? "награда"} ·{" "}
                      {Math.min(
                        100,
                        Math.round((u.balance / u.goal.target_amount) * 100)
                      )}
                      % из {u.goal.target_amount}
                    </span>
                  ) : (
                    <span className="inline-block mt-1.5 text-xs bg-dark-700 text-gray-500 px-2 py-0.5 rounded-full">
                      Цели нет
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/employees/${u.id}`}
                    className="text-xs bg-dark-700 rounded-lg px-3 py-1.5"
                  >
                    История
                  </Link>
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
                  {u.is_active ? (
                    <button
                      onClick={() => handleOffboard(u.id, u.name)}
                      disabled={isPending}
                      className="text-xs bg-red-500/20 text-red-400 rounded-lg px-3 py-1.5"
                    >
                      Уволить
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReinstate(u.id, u.name)}
                      disabled={isPending}
                      className="text-xs bg-acid-400/10 text-acid-400 rounded-lg px-3 py-1.5"
                    >
                      Восстановить
                    </button>
                  )}
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
            )}
          </div>
        );
      })}
    </div>
  );
}
