"use client";

import { useTransition, useState } from "react";
import {
  approveBonusRequest,
  rejectBonusRequest,
  bulkApproveBonus,
  bulkRejectBonus,
  manualAdjustBalance,
  manualAdjustBalanceBulk,
} from "@/app/admin/actions";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";

const statusLabels = {
  pending: { label: "Ожидает", color: "bg-yellow-500/10 text-yellow-400" },
  approved: { label: "Подтверждено", color: "bg-acid-400/10 text-acid-400" },
  rejected: { label: "Отклонено", color: "bg-red-500/10 text-red-400" },
};

export default function BonusRequestsClient({ requests, employees }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  // Одному участнику
  const [singleUserId, setSingleUserId] = useState(employees[0]?.id ?? "");
  const [singleAmount, setSingleAmount] = useState("");
  const [singleReason, setSingleReason] = useState("");

  // Нескольким участникам (ручное начисление, не путать с заявками)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkReason, setBulkReason] = useState("");

  const pending = requests.filter((r) => r.status === "pending");
  const processed = requests.filter((r) => r.status !== "pending");

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function handleApprove(id) {
    startTransition(() => approveBonusRequest(id));
  }

  function handleReject(id) {
    startTransition(() => rejectBonusRequest(id));
  }

  function toggleSelected(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === pending.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pending.map((r) => r.id));
    }
  }

  function handleBulkApprove() {
    startTransition(async () => {
      const res = await bulkApproveBonus(selectedIds);
      showMessage(`Подтверждено: ${res.count}`);
      setSelectedIds([]);
    });
  }

  function handleBulkReject() {
    startTransition(async () => {
      const res = await bulkRejectBonus(selectedIds);
      showMessage(`Отклонено: ${res.count}`);
      setSelectedIds([]);
    });
  }

  function handleSingleSubmit(e) {
    e.preventDefault();
    const amount = Number(singleAmount);
    if (!singleUserId || !amount) return;

    startTransition(async () => {
      const res = await manualAdjustBalance(singleUserId, amount, singleReason);
      if (res.error) showMessage(res.error, "error");
      else {
        showMessage("Начислено");
        setSingleAmount("");
        setSingleReason("");
      }
    });
  }

  function toggleEmployeeSelected(id) {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleEmployeeBulkSubmit(e) {
    e.preventDefault();
    const amount = Number(bulkAmount);
    if (selectedEmployeeIds.length === 0 || !amount) return;

    startTransition(async () => {
      const res = await manualAdjustBalanceBulk(
        selectedEmployeeIds,
        amount,
        bulkReason
      );
      if (res.error) showMessage(res.error, "error");
      else {
        showMessage(`Начислено ${res.count} чел.`);
        setBulkAmount("");
        setBulkReason("");
        setSelectedEmployeeIds([]);
      }
    });
  }

  return (
    <div className="space-y-6">
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

      <div className="grid md:grid-cols-2 gap-4">
        {/* Одному участнику */}
        <form
          onSubmit={handleSingleSubmit}
          className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3"
        >
          <p className="text-sm text-gray-500">Добавить одному участнику</p>
          <select
            value={singleUserId}
            onChange={(e) => setSingleUserId(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={singleAmount}
            onChange={(e) => setSingleAmount(e.target.value)}
            placeholder="Количество coins (можно минус)"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
          />
          <input
            value={singleReason}
            onChange={(e) => setSingleReason(e.target.value)}
            placeholder="За что"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-acid-400 text-black font-bold rounded-lg py-2.5 text-sm"
          >
            Начислить
          </button>
        </form>

        {/* Нескольким участникам */}
        <form
          onSubmit={handleEmployeeBulkSubmit}
          className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3"
        >
          <p className="text-sm text-gray-500">
            Добавить нескольким одинаково
          </p>
          <div className="max-h-32 overflow-y-auto space-y-1 bg-dark-700 border border-dark-600 rounded-lg p-2">
            {employees.map((emp) => (
              <label
                key={emp.id}
                className="flex items-center gap-2 text-sm py-1 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedEmployeeIds.includes(emp.id)}
                  onChange={() => toggleEmployeeSelected(emp.id)}
                />
                {emp.name}
              </label>
            ))}
          </div>
          <input
            type="number"
            value={bulkAmount}
            onChange={(e) => setBulkAmount(e.target.value)}
            placeholder="Количество coins (можно минус)"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
          />
          <input
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            placeholder="За что"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-acid-400 text-black font-bold rounded-lg py-2.5 text-sm"
          >
            Начислить выбранным ({selectedEmployeeIds.length})
          </button>
        </form>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Заявки от сотрудников, ожидают подтверждения ({pending.length})
          </p>
          {pending.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="text-xs text-gray-400 hover:text-white"
            >
              {selectedIds.length === pending.length
                ? "Снять выделение"
                : "Выбрать все"}
            </button>
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="flex gap-2 bg-dark-800 border border-acid-400 rounded-xl p-3">
            <span className="text-sm text-gray-300 flex-1 self-center">
              Выбрано: {selectedIds.length}
            </span>
            <button
              onClick={handleBulkApprove}
              disabled={isPending}
              className="bg-acid-400 text-black font-bold rounded-lg px-3 py-2 text-sm"
            >
              Подтвердить выбранные
            </button>
            <button
              onClick={handleBulkReject}
              disabled={isPending}
              className="bg-red-500/20 text-red-400 rounded-lg px-3 py-2 text-sm"
            >
              Отклонить выбранные
            </button>
          </div>
        )}

        {pending.length === 0 && (
          <p className="text-gray-600 text-sm">Нет новых заявок</p>
        )}
        {pending.map((r) => (
          <div
            key={r.id}
            className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center gap-3"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(r.id)}
              onChange={() => toggleSelected(r.id)}
              className="w-5 h-5 shrink-0"
            />
            <div className="flex-1 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">{r.users?.name}</p>
                <p className="text-sm">
                  {BONUS_CATEGORIES[r.category]?.label ?? r.category} →{" "}
                  <span className="text-acid-400 font-bold">
                    {r.amount_coins} coins
                  </span>
                </p>
                {r.comment && (
                  <p className="text-xs text-gray-500">{r.comment}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleApprove(r.id)}
                  disabled={isPending}
                  className="bg-acid-400 text-black font-bold rounded-lg px-3 py-2 text-sm"
                >
                  Подтвердить
                </button>
                <button
                  onClick={() => handleReject(r.id)}
                  disabled={isPending}
                  className="bg-red-500/20 text-red-400 rounded-lg px-3 py-2 text-sm"
                >
                  Отклонить
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-500">История</p>
        {processed.map((r) => {
          const meta = statusLabels[r.status];
          return (
            <div
              key={r.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold">{r.users?.name}</p>
                <p className="text-sm text-gray-500">
                  {BONUS_CATEGORIES[r.category]?.label ?? r.category} ·{" "}
                  {r.amount_coins} coins
                </p>
                <p className="text-xs text-gray-600">
                  {new Date(
                    r.reviewed_at || r.created_at
                  ).toLocaleString("ru-RU")}
                </p>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full ${meta.color}`}>
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
