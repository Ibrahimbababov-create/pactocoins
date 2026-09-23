"use client";

import { useTransition, useState } from "react";
import EmptyState from "@/components/EmptyState";
import {
  rejectBonusRequest,
  bulkApproveBonus,
  bulkRejectBonus,
  cancelApprovedBonusRequest,
} from "@/app/admin/actions";
import {
  manualAdjustBalanceExempt,
  manualAdjustBalanceBulkExempt,
  approveBonusRequestExempt,
} from "@/app/admin/ratingExemptActions";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";
import EmployeePicker from "@/components/EmployeePicker";
import TopBonus from "@/components/TopBonus";
import { WEEKLY_TOP, MONTHLY_TOP } from "@/lib/topBonusConfig";

const statusLabels = {
  pending: { label: "Ожидает", color: "bg-yellow-500/10 text-yellow-400" },
  approved: { label: "Подтверждено", color: "bg-acid-400/10 text-acid-400" },
  rejected: { label: "Отклонено", color: "bg-red-500/10 text-red-400" },
};

export default function BonusRequestsClient({
  requests,
  employees,
  weekVariants = [],
  monthVariants = [],
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [exemptMap, setExemptMap] = useState({});
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [comments, setComments] = useState({});
  const [cancelComments, setCancelComments] = useState({});

  // Одному участнику
  const [singleUserId, setSingleUserId] = useState(employees[0]?.id ?? "");
  const [singleAmount, setSingleAmount] = useState("");
  const [singleReason, setSingleReason] = useState("");
  const [singleExempt, setSingleExempt] = useState(false);

  // Нескольким участникам
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkExempt, setBulkExempt] = useState(false);

  const pending = requests.filter(
    (r) => r.status === "pending" && !hiddenIds.has(r.id)
  );
  const processed = requests.filter((r) => r.status !== "pending");

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function hide(ids) {
    setHiddenIds((prev) => new Set([...prev, ...ids]));
  }

  function unhide(ids) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  function handleApprove(id) {
    const exempt = !!exemptMap[id];
    const comment = comments[id] || undefined;
    hide([id]);
    startTransition(async () => {
      const res = await approveBonusRequestExempt(id, exempt, comment);
      if (res?.error) {
        unhide([id]);
        showMessage(res.error, "error");
      }
    });
  }

  function handleReject(id) {
    const comment = comments[id] || undefined;
    hide([id]);
    startTransition(async () => {
      const res = await rejectBonusRequest(id, comment);
      if (res?.error) {
        unhide([id]);
        showMessage(res.error, "error");
      }
    });
  }

  function handleCancelApproved(id) {
    if (!window.confirm("Отменить одобренную заявку? Coins (или крутка) спишутся обратно.")) return;
    const comment = cancelComments[id] || undefined;
    startTransition(async () => {
      const res = await cancelApprovedBonusRequest(id, comment);
      if (res?.error) showMessage(res.error, "error");
      else showMessage("Заявка отменена");
    });
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
    const ids = selectedIds;
    hide(ids);
    setSelectedIds([]);
    startTransition(async () => {
      const res = await bulkApproveBonus(ids);
      if (res?.error) {
        unhide(ids);
        showMessage(res.error, "error");
      } else {
        showMessage(`Подтверждено: ${res.count}`);
      }
    });
  }

  function handleBulkReject() {
    const ids = selectedIds;
    hide(ids);
    setSelectedIds([]);
    startTransition(async () => {
      const res = await bulkRejectBonus(ids);
      if (res?.error) {
        unhide(ids);
        showMessage(res.error, "error");
      } else {
        showMessage(`Отклонено: ${res.count}`);
      }
    });
  }

  function handleSingleSubmit(e) {
    e.preventDefault();
    const amount = Number(singleAmount);
    if (!singleUserId || !amount) return;

    startTransition(async () => {
      const res = await manualAdjustBalanceExempt(
        singleUserId,
        amount,
        singleReason,
        singleExempt
      );
      if (res.error) showMessage(res.error, "error");
      else {
        showMessage("Начислено");
        setSingleAmount("");
        setSingleReason("");
        setSingleExempt(false);
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
      const res = await manualAdjustBalanceBulkExempt(
        selectedEmployeeIds,
        amount,
        bulkReason,
        bulkExempt
      );
      if (res.error) showMessage(res.error, "error");
      else {
        showMessage(`Начислено ${res.count} чел.`);
        setBulkAmount("");
        setBulkReason("");
        setSelectedEmployeeIds([]);
        setBulkExempt(false);
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

      <div className="grid lg:grid-cols-2 gap-4">
        <TopBonus
          title="🏆 Топ-3 · неделя"
          variants={weekVariants}
          min={WEEKLY_TOP.min}
          defaults={WEEKLY_TOP.prizes.map(String)}
        />
        <TopBonus
          title="🏆 Топ-3 · месяц"
          variants={monthVariants}
          min={MONTHLY_TOP.min}
          defaults={MONTHLY_TOP.prizes.map(String)}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Одному участнику */}
        <form
          onSubmit={handleSingleSubmit}
          className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3"
        >
          <p className="text-xs text-gray-400">
            Добавить одному участнику
          </p>
          <EmployeePicker
            employees={employees}
            value={singleUserId}
            onChange={setSingleUserId}
          />
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
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={singleExempt}
              onChange={(e) => setSingleExempt(e.target.checked)}
            />
            Не учитывать в рейтинге (ДР и т.п.)
          </label>
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
          <p className="text-xs text-gray-400">
            Добавить нескольким одинаково
          </p>
          <EmployeePicker
            employees={employees}
            multiple
            values={selectedEmployeeIds}
            onToggle={toggleEmployeeSelected}
            placeholder="Найти сотрудников…"
          />
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
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={bulkExempt}
              onChange={(e) => setBulkExempt(e.target.checked)}
            />
            Не учитывать в рейтинге (ДР и т.п.)
          </label>
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
          <p className="text-xs text-gray-400">
            Заявки от сотрудников ({pending.length})
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
          <EmptyState icon="award" title="Нет новых заявок" hint="Все заявки на бонусы разобраны." />
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
            <div className="flex-1 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {r.users?.name}
                  {r.users?.is_guest && (
                    <span className="text-xs text-gray-500 font-normal"> (гость)</span>
                  )}
                </p>
                <p className="text-sm">
                  {BONUS_CATEGORIES[r.category]?.label ?? r.category} →{" "}
                  <span className="text-acid-400 font-bold">
                    {r.amount_coins.toLocaleString("ru-RU")} coins
                  </span>
                </p>
                {r.comment && (
                  <p className="text-xs text-gray-500">{r.comment}</p>
                )}
                <label className="flex items-center gap-2 text-xs text-gray-500 mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!exemptMap[r.id]}
                    onChange={(e) =>
                      setExemptMap((prev) => ({
                        ...prev,
                        [r.id]: e.target.checked,
                      }))
                    }
                  />
                  Не в рейтинг (ДР и т.п.)
                </label>
                <input
                  value={comments[r.id] || ""}
                  onChange={(e) =>
                    setComments((prev) => ({ ...prev, [r.id]: e.target.value }))
                  }
                  placeholder="💬 Комментарий сотруднику (необязательно)"
                  className="mt-2 w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
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
        <p className="text-xs text-gray-400">История</p>
        {processed.map((r) => {
          const meta = statusLabels[r.status];
          return (
            <div
              key={r.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {r.users?.name}
                    {r.users?.is_guest && (
                      <span className="text-xs text-gray-500 font-normal"> (гость)</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    {BONUS_CATEGORIES[r.category]?.label ?? r.category} ·{" "}
                    {r.amount_coins.toLocaleString("ru-RU")} coins
                  </p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full ${meta.color}`}>
                  {meta.label}
                </span>
              </div>
              {r.status === "approved" && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={cancelComments[r.id] || ""}
                    onChange={(e) =>
                      setCancelComments((prev) => ({ ...prev, [r.id]: e.target.value }))
                    }
                    placeholder="💬 Причина отмены сотруднику (необязательно)"
                    className="flex-1 min-w-[160px] bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                  <button
                    onClick={() => handleCancelApproved(r.id)}
                    disabled={isPending}
                    className="text-xs bg-red-500/20 text-red-400 rounded-lg px-3 py-1.5 shrink-0 disabled:opacity-50"
                  >
                    Отменить одобрение
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
