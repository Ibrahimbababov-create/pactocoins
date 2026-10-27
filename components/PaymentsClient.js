"use client";

import { revenueKindText, PRODUCT_LABELS, PAY_LABELS, clientKey } from "@/lib/revenueKinds";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { formatCoins } from "@/lib/plural";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import {
  formatDateTimeAlmaty,
  almatyDayKey,
  monthRangeAlmaty,
  recentMonthKeysAlmaty,
} from "@/lib/timezone";
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

const dayShift = (n) => almatyDayKey(new Date(Date.now() - n * 86400000));

// Быстрые периоды (по Алматы).
function periodPresets() {
  const today = dayShift(0);
  const months = recentMonthKeysAlmaty(2);
  const thisKey = months[0].key;
  const prevKey = months[1].key;
  const prevEnd = almatyDayKey(new Date(new Date(monthRangeAlmaty(prevKey).end).getTime() - 86400000));
  return [
    { id: "month", label: "Этот месяц", from: `${thisKey}-01`, to: today },
    { id: "prev", label: "Прошлый месяц", from: `${prevKey}-01`, to: prevEnd },
    { id: "week", label: "7 дней", from: dayShift(6), to: today },
  ];
}

const sameIds = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

const chipCls = (on) =>
  `px-3 py-2 rounded-xl text-sm border transition-colors ${
    on ? "bg-acid-400/15 border-acid-400/40 text-acid-400" : "border-dark-600 text-gray-300"
  }`;

function Step({ n, title, children }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-dark-700 border border-dark-600 text-acid-400 text-xs font-display flex items-center justify-center">
          {n}
        </span>
        {title}
      </p>
      {children}
    </div>
  );
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
const payments = (n) => `${n} ${plural(n, "оплата", "оплаты", "оплат")}`;

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
  const [view, setView] = useState("people");
  const [open, setOpen] = useState({});
  const [customPeriod, setCustomPeriod] = useState(false);

  // В списке выбора есть и уволенные: их оплаты тоже сверяются с таблицами.
  const pickable = useMemo(
    () => employees.map((e) => (e.is_active === false ? { ...e, name: `${e.name} (уволен)` } : e)),
    [employees]
  );
  const nameById = useMemo(() => new Map(pickable.map((e) => [e.id, e.name])), [pickable]);
  const firedIds = useMemo(() => new Set(employees.filter((e) => e.is_active === false).map((e) => e.id)), [employees]);
  const firedCount = firedIds.size;

  // «Вся команда РОПа»: сам РОП, его люди и уволенные из этой команды.
  const teams = useMemo(
    () =>
      employees
        .filter((e) => e.role === "rop" && e.is_active !== false)
        .map((rop) => ({
          id: rop.id,
          name: rop.name,
          ids: employees.filter((e) => e.id === rop.id || e.rop_id === rop.id).map((e) => e.id),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees]
  );

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
  function apply(patch) {
    const next = { ...filters, ...patch };
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
    const byClient = new Map();
    for (const r of rows) {
      const ck = clientKey(r.client_name);
      const key = `${r.user_id}|${ck}`;
      const cur = byClient.get(key) ?? {
        key,
        userId: r.user_id,
        manager: r.users?.name ?? "Без имени",
        client: ck ? r.client_name : "Клиент не указан",
        items: [],
        sum: 0,
      };
      cur.items.push(r);
      cur.sum += Number(r.amount_kzt ?? 0);
      byClient.set(key, cur);
    }
    for (const c of byClient.values()) {
      c.items.sort((a, b) => new Date(a.earned_at || a.created_at) - new Date(b.earned_at || b.created_at));
    }
    return {
      sum,
      byMop: [...byMop.values()].sort((a, b) => b.sum - a.sum),
      byClient: [...byClient.values()].sort((a, b) => b.sum - a.sum),
    };
  }, [rows]);

  const firedInRows = totals.byMop.filter((m) => firedIds.has(m.id)).length;
  const presets = periodPresets();
  const activePreset = presets.find((p) => p.from === filters.from && p.to === filters.to)?.id;
  const everyone = filters.userIds.length === 0;
  const activeTeam = teams.find((t) => sameIds(t.ids, filters.userIds));
  const manual = !everyone && !activeTeam;
  const toggleOpen = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

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

  function renderCard(r) {
    return (
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
    );
  }

  const personCards = (id) => rows.filter((r) => r.user_id === id);

  return (
    <div className="space-y-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl p-4 space-y-5">
        <Step n="1" title="За какой период">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setCustomPeriod(false); apply({ from: p.from, to: p.to }); }}
                className={chipCls(activePreset === p.id && !customPeriod)}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomPeriod((v) => !v)}
              className={chipCls(customPeriod || !activePreset)}
            >
              Свой период
            </button>
          </div>
          {(customPeriod || !activePreset) && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1">
                <span className="text-xs text-gray-500">с</span>
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                  className="block bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-500">по</span>
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                  className="block bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => search()}
                disabled={isPending}
                className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-40"
              >
                Показать
              </button>
            </div>
          )}
        </Step>

        <Step n="2" title="Чьи оплаты">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => apply({ userIds: [] })} className={chipCls(everyone)}>
              Все
            </button>
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => apply({ userIds: t.ids.slice(0, MAX_PEOPLE) })}
                className={chipCls(activeTeam?.id === t.id)}
              >
                Команда {t.name}
              </button>
            ))}
            <button type="button" onClick={() => setPickerOpen(true)} className={chipCls(manual)}>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="users" className="w-4 h-4" />
                {manual ? `Выбрано: ${filters.userIds.length}` : "Выбрать людей"}
              </span>
            </button>
          </div>
          {manual && (
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
          {(everyone || activeTeam) && firedCount > 0 && (
            <p className="text-xs text-gray-500">В итог входят и уволенные: их оплаты тоже есть в таблицах.</p>
          )}
        </Step>

        <Step n="3" title="Сравните с таблицей зарплат">
          <p className="text-xs text-gray-500">
            Ниже сумма и число оплат по каждому человеку. Нажмите на строку, чтобы увидеть сами оплаты.
          </p>
        </Step>
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
        <p className={`text-sm ${message.type === "error" ? "text-red-400" : "text-acid-400"}`}>
          {message.text}
        </p>
      )}

      <div className={`bg-dark-800 border border-dark-700 rounded-2xl p-4 space-y-4 ${isPending ? "opacity-60" : ""}`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">Всего оплат на сумму</p>
            <p className="font-display text-3xl tabular-nums">{money(totals.sum)} ₸</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {payments(rows.length)} · {totals.byMop.length} {plural(totals.byMop.length, "человек", "человека", "человек")}
              {firedInRows > 0 && ` (уволенных: ${firedInRows})`}
            </p>
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

        <div className="flex gap-2 overflow-x-auto">
          {[
            ["people", "По людям"],
            ["clients", "По клиентам"],
            ["list", "Все оплаты"],
          ].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setView(id)} className={`${chipCls(view === id)} whitespace-nowrap`}>
              {label}
            </button>
          ))}
        </div>

        {view === "people" && (
          <div className="divide-y divide-dark-700 -mx-1">
            {totals.byMop.map((m) => (
              <div key={m.id}>
                <button
                  type="button"
                  onClick={() => toggleOpen(m.id)}
                  aria-expanded={!!open[m.id]}
                  className="w-full flex items-center justify-between gap-3 px-1 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {m.name}
                      {firedIds.has(m.id) && (
                        <span className="ml-2 align-middle text-[11px] font-normal rounded-md bg-red-500/15 text-red-400 px-1.5 py-0.5">
                          уволен
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-gray-500">{payments(m.count)}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-display text-lg tabular-nums">{money(m.sum)} ₸</span>
                    <Icon name="chevronDown" className={`w-4 h-4 text-gray-500 transition-transform ${open[m.id] ? "rotate-180" : ""}`} />
                  </span>
                </button>
                {open[m.id] && <div className="space-y-2 pb-3">{personCards(m.id).map(renderCard)}</div>}
              </div>
            ))}
          </div>
        )}

        {view === "clients" && (
          <div className="divide-y divide-dark-700 -mx-1">
            <p className="text-xs text-gray-500 px-1 pb-2">
              Оплаты одного клиента у одного менеджера сложены вместе: предоплата и доплата дают итог.
            </p>
            {totals.byClient.map((c) => (
              <div key={c.key}>
                <button
                  type="button"
                  onClick={() => toggleOpen(c.key)}
                  aria-expanded={!!open[c.key]}
                  className="w-full flex items-center justify-between gap-3 px-1 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{c.client}</span>
                    <span className="block truncate text-xs text-gray-500">
                      {c.manager}
                      {firedIds.has(c.userId) ? " (уволен)" : ""}
                    </span>
                    {c.items.length > 1 && (
                      <span className="block text-xs text-gray-400 tabular-nums">
                        {c.items.map((i) => money(i.amount_kzt)).join(" + ")}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-display text-lg tabular-nums">{money(c.sum)} ₸</span>
                    <Icon name="chevronDown" className={`w-4 h-4 text-gray-500 transition-transform ${open[c.key] ? "rotate-180" : ""}`} />
                  </span>
                </button>
                {open[c.key] && <div className="space-y-2 pb-3">{c.items.map(renderCard)}</div>}
              </div>
            ))}
          </div>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500">Найти оплату по сумме</summary>
          <div className="flex gap-2 mt-2">
            <input
              value={filters.query}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              placeholder="например 199"
              className="flex-1 min-w-0 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => search()}
              disabled={isPending}
              className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-40"
            >
              Найти
            </button>
          </div>
        </details>
      </div>

      {view === "list" && rows.length > LIST_LIMIT && (
        <p className="text-xs text-gray-600">
          Ниже последние {LIST_LIMIT}. Итоги и таблица считают все {rows.length}.
        </p>
      )}

      {view === "list" && rows.slice(0, LIST_LIMIT).map(renderCard)}

      {rows.length === 0 && (
        <p className="text-sm text-gray-500">
          Ничего не нашлось. Сбрось фильтры или поменяй период.
        </p>
      )}
    </div>
  );
}
