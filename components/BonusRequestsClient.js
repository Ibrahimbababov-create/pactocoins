"use client";

import { formatCoins } from "@/lib/plural";

import { useTransition, useState } from "react";
import CancelWithReason from "@/components/CancelWithReason";
import { loadRequestHistory } from "@/app/admin/historyActions";
import EmptyState from "@/components/EmptyState";
import {
  rejectBonusRequest,
  bulkApproveBonus,
  bulkRejectBonus,
  cancelApprovedBonusRequest,
} from "@/app/admin/actions";
import {
  manualAdjustBalanceBulkExempt,
  approveBonusRequestExempt,
} from "@/app/admin/ratingExemptActions";
import { BONUS_CATEGORIES, bonusRewardText } from "@/lib/bonusCategories";
import EmployeePicker from "@/components/EmployeePicker";
import NameSearchInput from "@/components/NameSearchInput";
import { matchesName } from "@/lib/translit";
import TopBonus from "@/components/TopBonus";
import { WEEKLY_TOP } from "@/lib/topBonusConfig";

const statusLabels = {
  pending: { label: "Ожидает", color: "bg-yellow-500/10 text-yellow-400" },
  approved: { label: "Подтверждено", color: "bg-acid-400/10 text-acid-400" },
  rejected: { label: "Отклонено", color: "bg-red-500/10 text-red-400" },
};

export default function BonusRequestsClient({
  requests,
  employees,
  weekVariants = [],
  historyTotal = 0,
  historyPageSize = 20,
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  // История приходит с сервера порциями и копится здесь.
  const [extraHistory, setExtraHistory] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [exemptMap, setExemptMap] = useState({});
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [comments, setComments] = useState({});

  // Один режим на всех: выбрал одного или нескольких, одинаковая сумма каждому.
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkExempt, setBulkExempt] = useState(false);

  const [nameQuery, setNameQuery] = useState("");
  const nameOk = (r) => !nameQuery.trim() || matchesName(r.users?.name ?? "", nameQuery.trim());
  const pending = requests.filter(
    (r) => r.status === "pending" && !hiddenIds.has(r.id) && nameOk(r)
  );
  const processedAll = [
    ...requests.filter((r) => r.status !== "pending"),
    ...extraHistory,
  ];
  const processed = processedAll.filter(nameOk);

  async function loadMore() {
    setLoadingMore(true);
    const res = await loadRequestHistory("bonus", processedAll.length, historyPageSize);
    if (res?.rows) setExtraHistory((prev) => [...prev, ...res.rows]);
    setLoadingMore(false);
  }

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

  function handleCancelApproved(id, comment) {
    if (!window.confirm("Отменить одобренную заявку? Коины (или крутка) спишутся обратно.")) return;

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

  function toggleEmployeeSelected(id) {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleEmployeeBulkSubmit(e) {
    e.preventDefault();
    const amount = Number(bulkAmount);
    if (selectedEmployeeIds.length === 0) {
      showMessage("Выбери сотрудника", "error");
      return;
    }
    if (!amount) return;
    const count = selectedEmployeeIds.length;
    const who = count === 1 ? employees.find((x) => x.id === selectedEmployeeIds[0])?.name ?? "сотруднику" : null;
    const what = amount > 0 ? "Начислить" : "Списать";
    const sum = formatCoins(Math.abs(amount));
    const question = who
      ? `${what} ${sum}: ${who}?`
      : `${what} по ${sum}, людей: ${count}?`;
    if (!window.confirm(question)) return;

    startTransition(async () => {
      const res = await manualAdjustBalanceBulkExempt(
        selectedEmployeeIds,
        amount,
        bulkReason || (count === 1 ? "Ручная корректировка" : ""),
        bulkExempt
      );
      if (res.error) showMessage(res.error, "error");
      else if (!res.count) {
        showMessage("Никому не получилось: баланс не может уйти в минус", "error");
      } else {
        showMessage(
          count === 1
            ? amount > 0 ? "Начислено" : "Списано"
            : `${amount > 0 ? "Начислено" : "Списано"}: ${res.count} чел.`
        );
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

      <div className="grid gap-4">
        <TopBonus
          title="Топ-3 · неделя"
          variants={weekVariants}
          min={WEEKLY_TOP.min}
          defaults={WEEKLY_TOP.prizes.map(String)}
        />
      </div>

      <div className="grid gap-4">
        {/* Бонус: одному или нескольким сразу */}
        <form
          onSubmit={handleEmployeeBulkSubmit}
          className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3"
        >
          <p className="text-xs text-gray-400">
            Бонус: выбери одного или нескольких, каждый получит одинаково
          </p>
          <EmployeePicker
            employees={employees}
            multiple
            values={selectedEmployeeIds}
            onToggle={toggleEmployeeSelected}
            placeholder="Найти сотрудника…"
          />
          <input
            type="number"
            value={bulkAmount}
            onChange={(e) => setBulkAmount(e.target.value)}
            placeholder="Количество коинов (можно минус)"
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
            {selectedEmployeeIds.length > 1 ? `Начислить выбранным (${selectedEmployeeIds.length})` : "Начислить"}
          </button>
        </form>
      </div>

      <NameSearchInput
        value={nameQuery}
        onChange={(v) => {
          setNameQuery(v);
          setSelectedIds([]);
        }}
      />

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
                    {bonusRewardText(r)}
                  </span>
                </p>
                {r.comment && (
                  <p className="text-xs text-gray-500">{r.comment}</p>
                )}
                <input
                  value={comments[r.id] || ""}
                  onChange={(e) =>
                    setComments((prev) => ({ ...prev, [r.id]: e.target.value }))
                  }
                  placeholder="Комментарий сотруднику (необязательно)"
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
                    {bonusRewardText(r)}
                  </p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full ${meta.color}`}>
                  {meta.label}
                </span>
              </div>
              {r.status === "approved" && (
                <CancelWithReason
                    disabled={isPending}
                    onCancel={(reason) => handleCancelApproved(r.id, reason || undefined)}
                  />
              )}
            </div>
          );
        })}

        {processedAll.length < historyTotal && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full border border-dark-600 rounded-xl py-2.5 text-sm text-gray-400 active:opacity-60 disabled:opacity-40"
          >
            {loadingMore ? "Гружу…" : `Показать ещё ${historyPageSize}`}
          </button>
        )}
      </div>
    </div>
  );
}
