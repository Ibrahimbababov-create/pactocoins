"use client";

import { revenueKindText, PRODUCT_LABELS, PAY_LABELS } from "@/lib/revenueKinds";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { formatCoins } from "@/lib/plural";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import { findPayments, cancelPayment, adjustPayment } from "@/app/admin/paymentActions";
import EmployeePicker from "@/components/EmployeePicker";

function money(n) {
  return Number(n ?? 0).toLocaleString("ru-RU");
}

// Дата в формате для поля <input type="date"> по Алматы.
function dateInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const almaty = new Date(d.getTime() + 5 * 3600 * 1000);
  return almaty.toISOString().slice(0, 10);
}

const LIST_LIMIT = 60;

const MAX_PEOPLE = 100;

// Окно выбора людей: поиск, команды, «Выбрать всех», «Сбросить».
// Рисуем в body, чтобы оно не зависело от обёрток страницы.
function PeopleDialog({ employees, values, onToggle, onSetAll, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Выбор сотрудников"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[85vh] flex flex-col bg-dark-800 border border-dark-600 rounded-t-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 p-4 pb-2">
          <p className="font-display font-bold">Кого показать</p>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="p-1 text-gray-400">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          <button
            type="button"
            onClick={() => onSetAll(employees.slice(0, MAX_PEOPLE).map((e) => e.id))}
            className="text-xs border border-dark-600 rounded-lg px-3 py-1.5 text-gray-200"
          >
            Выбрать всех
          </button>
          <button
            type="button"
            onClick={() => onSetAll([])}
            className="text-xs border border-dark-600 rounded-lg px-3 py-1.5 text-gray-400"
          >
            Сбросить
          </button>
          <span className="text-xs text-gray-500 self-center">
            Выбрано: {values.length}
          </span>
        </div>
        <div className="px-4 overflow-y-auto min-h-0 flex-1">
          <EmployeePicker
            employees={employees}
            multiple
            values={values}
            onToggle={onToggle}
          />
        </div>
        <div className="p-4 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-acid-400 text-black font-bold rounded-lg py-2.5 text-sm"
          >
            Готово
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function PaymentsClient({ employees, initialRows, initialFrom = "", initialTo = "", initialUserIds = [] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(initialRows ?? []);
  const [filters, setFilters] = useState({ userIds: initialUserIds, from: initialFrom, to: initialTo, query: "" });
  const [pickerOpen, setPickerOpen] = useState(false);

  // В списке выбора есть и уволенные: их оплаты тоже сверяются с таблицами.
  const pickable = useMemo(
    () => employees.map((e) => (e.is_active === false ? { ...e, name: `${e.name} (уволен)` } : e)),
    [employees]
  );
  const nameById = useMemo(() => new Map(pickable.map((e) => [e.id, e.name])), [pickable]);

  function toggleUser(id) {
    setFilters((f) => ({
      ...f,
      userIds: f.userIds.includes(id)
        ? f.userIds.filter((x) => x !== id)
        : f.userIds.length < MAX_PEOPLE ? [...f.userIds, id] : f.userIds,
    }));
  }

  // Чип с крестиком убирает человека и сразу обновляет итоги.
  function removeUser(id) {
    const next = { ...filters, userIds: filters.userIds.filter((x) => x !== id) };
    setFilters(next);
    search(next);
  }
  const [editingId, setEditingId] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);
  const [message, setMessage] = useState(null);

  function say(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  function search(next = filters) {
    // Выбор и период лежат в адресе: ссылку можно отправить, обновление не сбросит.
    try {
      const params = new URLSearchParams();
      if (next.userIds?.length) params.set("u", next.userIds.join(","));
      if (next.from) params.set("from", next.from);
      if (next.to) params.set("to", next.to);
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    } catch {}
    startTransition(async () => {
      const res = await findPayments(next);
      if (res?.error) return say(res.error, "error");
      setRows(res.rows ?? []);
    });
  }

  const totals = useMemo(() => {
    const byMop = new Map();
    let sum = 0;
    for (const r of rows) {
      const amount = Number(r.amount_kzt ?? 0);
      sum += amount;
      const key = r.user_id;
      const cur = byMop.get(key) ?? { id: key, name: r.users?.name ?? "Без имени", count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += amount;
      byMop.set(key, cur);
    }
    return { sum, byMop: [...byMop.values()].sort((a, b) => b.sum - a.sum) };
  }, [rows]);

  function exportCsv() {
    const header = [
      "Дата оплаты (Алматы)",
      "МОП",
      "ФИО клиента",
      "Продукт",
      "Вид оплаты",
      "Последняя часть",
      "Сумма, ₸",
      "Статус",
      "Коины",
    ];
    const data = rows.map((r) => [
      formatDateTimeAlmaty(r.earned_at || r.created_at),
      r.users?.name ?? "",
      r.client_name ?? "",
      PRODUCT_LABELS[r.product_kind] ?? "",
      PAY_LABELS[r.pay_kind] ?? "",
      r.pay_kind === "part" ? (r.is_final_part ? "да" : "нет") : "",
      Number(r.amount_kzt ?? 0),
      "Подтверждена",
      r.credited_coins ?? r.calculated_coins ?? 0,
    ]);
    const stamp = `${filters.from || "начало"}_${filters.to || "сегодня"}`;
    downloadCsv(`оплаты_${stamp}.csv`, buildCsv(header, data));
  }

  function onCancel(row, reason) {
    startTransition(async () => {
      const res = await cancelPayment(row.id, reason);
      if (res?.error) return say(res.error, "error");
      say("Оплата отменена, коины списаны");
      setCancelingId(null);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      router.refresh();
    });
  }

  function onSave(row, form) {
    const amount = Number(String(form.get("amount")).replace(/\s/g, ""));
    const earnedAt = form.get("earned_at") || null;
    const reason = form.get("reason") || "";

    startTransition(async () => {
      const res = await adjustPayment(row.id, { amountKzt: amount, earnedAt, reason });
      if (res?.error) return say(res.error, "error");
      say(`Исправлено: ${money(row.amount_kzt)} → ${money(amount)} ₸`);
      setEditingId(null);

      // Поиск по сумме сбрасываем: искали «100000», исправили на «10000» —
      // и строка пропадала с экрана, будто всё сломалось. Остальные фильтры
      // (человек, даты) оставляем как есть.
      const next = { ...filters, query: "" };
      setFilters(next);
      search(next);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl p-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="space-y-1">
            <span className="text-xs text-gray-500">Сотрудники</span>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="w-full flex items-center justify-between gap-2 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-left"
            >
              <span className="truncate">
                {filters.userIds.length ? `Выбрано: ${filters.userIds.length}` : "Все"}
              </span>
              <Icon name="users" className="w-4 h-4 text-gray-500 shrink-0" />
            </button>
          </div>

          <label className="space-y-1">
            <span className="text-xs text-gray-500">Оплаты с</span>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-gray-500">по</span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-gray-500">Сумма содержит</span>
            <input
              value={filters.query}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              placeholder="199"
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => search()}
            disabled={isPending}
            className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-40"
          >
            {isPending ? "Ищу…" : "Найти"}
          </button>
          <button
            type="button"
            onClick={() => {
              const empty = { userIds: [], from: "", to: "", query: "" };
              setFilters(empty);
              search(empty);
            }}
            className="border border-dark-600 rounded-lg px-4 py-2 text-sm text-gray-400"
          >
            Сбросить
          </button>
        </div>
      </div>

      {pickerOpen && (
        <PeopleDialog
          employees={pickable}
          values={filters.userIds}
          onToggle={toggleUser}
          onSetAll={(ids) => setFilters((f) => ({ ...f, userIds: ids }))}
          onClose={() => { setPickerOpen(false); search(); }}
        />
      )}

      {message && (
        <p
          className={`text-sm ${
            message.type === "error" ? "text-red-400" : "text-acid-400"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="bg-dark-800 border border-dark-700 rounded-2xl p-4 space-y-3">
        {filters.userIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {filters.userIds.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 max-w-full bg-dark-700 border border-dark-600 rounded-full pl-3 pr-1.5 py-1 text-xs"
              >
                <span className="truncate">{nameById.get(id) ?? "Сотрудник"}</span>
                <button
                  type="button"
                  onClick={() => removeUser(id)}
                  aria-label="Убрать из выбора"
                  className="shrink-0 p-0.5 text-gray-400"
                >
                  <Icon name="x" className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">Итого по фильтрам</p>
            <p className="font-display text-xl tabular-nums">{money(totals.sum)} ₸</p>
            <p className="text-xs text-gray-500">Оплат: {rows.length}</p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="border border-dark-600 rounded-lg px-4 py-2 text-sm text-gray-200 disabled:opacity-40"
          >
            Скачать таблицей
          </button>
        </div>

        {totals.byMop.length > 0 && (
          <div className="border-t border-dark-700 pt-3 space-y-1.5">
            <p className="text-xs text-gray-500">По менеджерам</p>
            {totals.byMop.map((m) => (
              <p key={m.id} className="text-sm flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  {m.name} <span className="text-gray-600">· {m.count}</span>
                </span>
                <span className="tabular-nums shrink-0">{money(m.sum)} ₸</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {rows.length > LIST_LIMIT && (
        <p className="text-xs text-gray-600">
          Ниже последние {LIST_LIMIT}. Итоги и таблица считают все {rows.length}.
        </p>
      )}

      {rows.slice(0, LIST_LIMIT).map((r) => (
        <div
          key={r.id}
          className="bg-dark-800 border border-dark-700 rounded-2xl p-4 space-y-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{r.users?.name}</p>
              <p className="font-display text-lg tabular-nums">
                {money(r.amount_kzt)} ₸
                <span className="text-sm text-gray-500 font-sans">
                  {" "}
                  · {formatCoins(r.credited_coins ?? r.calculated_coins ?? 0)}
                </span>
              </p>
              <p className="text-xs text-gray-600">
                оплата от {formatDateTimeAlmaty(r.earned_at || r.created_at)}
              </p>
              {r.client_name && (
                <p className="text-sm text-gray-400">
                  Клиент: {r.client_name}
                  {revenueKindText(r) ? ` · ${revenueKindText(r)}` : ""}
                </p>
              )}
              {r.comment && (
                <p className="text-xs text-gray-500 mt-1">{r.comment}</p>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditingId(editingId === r.id ? null : r.id);
                  setCancelingId(null);
                }}
                className="text-xs border border-dark-600 rounded-lg px-3 py-1.5 text-gray-300"
              >
                Изменить
              </button>
              <button
                type="button"
                onClick={() => {
                  setCancelingId(cancelingId === r.id ? null : r.id);
                  setEditingId(null);
                }}
                disabled={isPending}
                className="text-xs bg-red-500/20 text-red-400 rounded-lg px-3 py-1.5 disabled:opacity-40"
              >
                Отменить
              </button>
            </div>
          </div>

          {cancelingId === r.id && (
            <form
              action={(fd) => onCancel(r, String(fd.get("reason") || ""))}
              className="border-t border-dark-700 pt-3 flex flex-wrap gap-2"
            >
              <input
                name="reason"
                autoFocus
                defaultValue="Возврат оплаты"
                placeholder="Причина, её увидит сотрудник"
                className="flex-1 min-w-[200px] bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={isPending}
                className="bg-red-500/20 text-red-400 font-semibold rounded-lg px-4 py-2 text-sm disabled:opacity-40"
              >
                Точно отменить
              </button>
              <button
                type="button"
                onClick={() => setCancelingId(null)}
                className="border border-dark-600 rounded-lg px-4 py-2 text-sm text-gray-400"
              >
                Назад
              </button>
            </form>
          )}

          {editingId === r.id && (
            <form
              action={(fd) => onSave(r, fd)}
              className="border-t border-dark-700 pt-3 grid gap-2 sm:grid-cols-4"
            >
              <label className="space-y-1">
                <span className="text-xs text-gray-500">Новая сумма, ₸</span>
                <input
                  name="amount"
                  defaultValue={r.amount_kzt}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-500">Дата оплаты</span>
                <input
                  type="date"
                  name="earned_at"
                  defaultValue={dateInputValue(r.earned_at || r.created_at)}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-gray-500">
                  Что написать сотруднику
                </span>
                <input
                  name="reason"
                  placeholder="Половина сделки ушла другому менеджеру"
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <button
                type="submit"
                disabled={isPending}
                className="sm:col-span-4 bg-acid-400 text-black font-bold rounded-lg py-2 text-sm disabled:opacity-40"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="check" className="w-4 h-4" strokeWidth={2.5} />
                  Сохранить и пересчитать коины
                </span>
              </button>
            </form>
          )}
        </div>
      ))}

      {rows.length === 0 && (
        <p className="text-sm text-gray-500">
          Ничего не нашлось. Сбрось фильтры или поменяй период.
        </p>
      )}
    </div>
  );
}
