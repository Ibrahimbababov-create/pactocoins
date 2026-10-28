"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import PaymentEditSheet from "@/components/PaymentEditSheet";
import { renameMyPaymentClient } from "@/app/mop/payments/actions";
import { haptic } from "@/lib/haptics";
import { clientKey, revenueKindText, clientNameHasBadChars, CLIENT_NAME_HINT } from "@/lib/revenueKinds";
import { almatyDayKey, formatPaymentDay } from "@/lib/timezone";
import { EDIT_FIELD_LABELS } from "@/lib/revenueEdits";

const NO_NAME = "без ФИО (до обновления)";

const STATUS = {
  approved: { label: "Подтверждена", color: "bg-acid-400/10 text-acid-400" },
  pending: { label: "Ждёт", color: "bg-amber-500/10 text-amber-400" },
};

const EDIT_STATUS = {
  pending: { label: "Исправление на рассмотрении", color: "text-amber-400" },
  approved: { label: "Исправление применено", color: "text-acid-400" },
  rejected: { label: "Исправление не принято", color: "text-red-400" },
};

function editFieldsText(proposed) {
  return Object.keys(proposed ?? {})
    .map((f) => EDIT_FIELD_LABELS[f])
    .filter(Boolean)
    .join(", ")
    .toLowerCase();
}

function money(n) {
  return Number(n ?? 0).toLocaleString("ru-RU");
}

function paidAt(r) {
  return r.earned_at || r.created_at;
}

// Клиенты с незакрытыми частями: была частичная оплата, финальной ещё нет.
function waitingClients(rows) {
  const map = new Map();
  const sorted = [...rows].sort((x, y) => new Date(paidAt(x)) - new Date(paidAt(y)));
  for (const r of sorted) {
    if (!r.client_name) continue;
    const key = clientKey(r.client_name);
    if (!map.has(key)) map.set(key, { key, name: r.client_name, rows: [] });
    map.get(key).rows.push(r);
  }
  return [...map.values()]
    .filter(
      (g) =>
        g.rows.some((r) => r.pay_kind === "part") &&
        !g.rows.some((r) => r.is_final_part || r.pay_kind === "full")
    )
    .map((g) => ({
      key: g.key,
      name: g.name,
      total: g.rows.reduce((s, r) => s + Number(r.amount_kzt ?? 0), 0),
      since: paidAt(g.rows[0]),
    }));
}

function monthBounds(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { min: `${monthKey}-01`, max: `${monthKey}-${String(last).padStart(2, "0")}` };
}

// Встроенная форма «Изменить ФИО»: имя меняется сразу, без админа.
function RenameForm({ row, onDone }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(row.client_name ?? "");
  const [error, setError] = useState(null);

  function save(e) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await renameMyPaymentClient(row.id, name);
      if (res?.error) {
        haptic.error();
        return setError(res.error);
      }
      haptic.success();
      onDone(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="space-y-2 border-t border-dark-700 pt-2">
      <input
        type="text"
        required
        maxLength={60}
        name="client-fio-no-memory"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Фамилия Имя"
        className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-base focus:outline-none focus:border-acid-400"
      />
      {clientNameHasBadChars(name) && <p className="text-xs text-red-400">{CLIENT_NAME_HINT}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm active:scale-95 disabled:opacity-50"
        >
          {isPending ? "Сохраняем..." : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={() => onDone(false)}
          className="text-sm text-gray-400 px-2 py-2 active:opacity-70"
        >
          Отмена
        </button>
      </div>
      <p className="text-[11px] text-gray-500 leading-snug">
        Имя можно менять сразу. Сумму, дату и тип оплаты меняет админ по твоему запросу.
      </p>
    </form>
  );
}

export default function MyPaymentsClient({
  months,
  monthKey,
  monthLabel,
  rows,
  edits = [],
  editsEnabled = false,
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [day, setDay] = useState("");
  const [openWaiting, setOpenWaiting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState(null);
  const [renamingId, setRenamingId] = useState(null);

  // Исправления по каждой оплате, новые сверху.
  const editsByRequest = useMemo(() => {
    const map = new Map();
    for (const e of edits) {
      if (!map.has(e.request_id)) map.set(e.request_id, []);
      map.get(e.request_id).push(e);
    }
    return map;
  }, [edits]);

  function closeEditor(sent) {
    setEditing(null);
    if (sent === true) {
      setNotice("Исправление отправлено админу. Оплата поменяется после его решения.");
      setTimeout(() => setNotice(null), 5000);
    }
  }

  const bounds = monthBounds(monthKey);
  const activeDay = day && day >= bounds.min && day <= bounds.max ? day : "";
  const q = query.trim().toLowerCase();
  const filtered = !!(q || activeDay);

  const shown = useMemo(
    () =>
      rows.filter((r) => {
        if (q && !(r.client_name || NO_NAME).toLowerCase().includes(q)) return false;
        if (activeDay && almatyDayKey(paidAt(r)) !== activeDay) return false;
        return true;
      }),
    [rows, q, activeDay]
  );

  const summary = useMemo(() => {
    const approved = shown.filter((r) => r.status === "approved");
    return {
      count: shown.length,
      approvedSum: approved.reduce((s, r) => s + Number(r.amount_kzt ?? 0), 0),
      pending: shown.filter((r) => r.status === "pending").length,
    };
  }, [shown]);

  const waiting = useMemo(() => waitingClients(rows), [rows]);

  function resetFilters() {
    setQuery("");
    setDay("");
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs text-gray-500">Месяц</span>
        <select
          value={monthKey}
          onChange={(e) => router.push(`/mop/payments?m=${e.target.value}`)}
          className="mt-1 w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm"
        >
          {months.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-3">
          <p className="text-[11px] text-gray-500">Оплат</p>
          <p className="font-display text-lg tabular-nums">
            {summary.count}
            {filtered && <span className="text-xs text-gray-500 font-sans"> из {rows.length}</span>}
          </p>
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 min-w-0">
          <p className="text-[11px] text-gray-500">Подтверждено</p>
          <p className="font-display text-sm tabular-nums break-words">
            {money(summary.approvedSum)} ₸
          </p>
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-3">
          <p className="text-[11px] text-gray-500">На рассмотрении</p>
          <p className="font-display text-lg tabular-nums">{summary.pending}</p>
        </div>
      </div>

      {waiting.length > 0 && (
        <div className="bg-dark-800 border border-dark-600 rounded-xl">
          <button
            type="button"
            onClick={() => setOpenWaiting((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
          >
            <span>Ждут доплаты ({waiting.length})</span>
            <span className="text-gray-500 text-xs">{openWaiting ? "Скрыть" : "Показать"}</span>
          </button>
          {openWaiting && (
            <div className="px-4 pb-3 space-y-1.5 border-t border-dark-700 pt-3">
              {waiting.map((g) => (
                <p key={g.key} className="text-sm flex justify-between gap-3">
                  <span className="min-w-0 break-words">{g.name}</span>
                  <span className="shrink-0 text-gray-400 text-right">
                    {money(g.total)} ₸ · с {formatPaymentDay(g.since).split(",")[0]}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти клиента по имени"
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-base"
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={activeDay}
              min={bounds.min}
              max={bounds.max}
              onChange={(e) => setDay(e.target.value)}
              aria-label="День оплаты"
              style={{ colorScheme: "dark" }}
              className="flex-1 min-w-0 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-base"
            />
            {filtered && (
              <button
                type="button"
                onClick={resetFilters}
                className="shrink-0 text-sm font-semibold text-acid-400 px-2 py-2 active:opacity-70"
              >
                Сбросить
              </button>
            )}
          </div>
        </div>
      )}

      {notice && (
        <div className="bg-acid-400/10 border border-acid-400/30 text-acid-400 rounded-xl px-4 py-3 text-sm">
          {notice}
        </div>
      )}

      {editing && <PaymentEditSheet row={editing} onClose={closeEditor} />}

      {rows.length === 0 && (
        <EmptyState
          icon="receipt"
          title="В этом месяце оплат нет"
          hint={`За ${monthLabel} ты ещё не записывал оплаты.`}
        />
      )}

      {shown.length > 0 && (
        <div className="space-y-2">
          {shown.map((r) => {
            const meta = STATUS[r.status] ?? STATUS.pending;
            const history = editsByRequest.get(r.id) ?? [];
            const hasPendingEdit = history.some((e) => e.status === "pending");
            const canRename = r.status === "pending" || r.status === "approved";
            const canEdit = editsEnabled && !hasPendingEdit && r.status !== "rejected";
            return (
              <div
                key={r.id}
                className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold break-words">
                      {r.client_name || NO_NAME}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatPaymentDay(paidAt(r))}
                      {revenueKindText(r) ? ` · ${revenueKindText(r)}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold tabular-nums">{money(r.amount_kzt)} ₸</p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                </div>

                {history.length > 0 && (
                  <div className="space-y-1 border-t border-dark-700 pt-2">
                    {history.slice(0, 3).map((e) => {
                      const st = EDIT_STATUS[e.status] ?? EDIT_STATUS.pending;
                      const fields = editFieldsText(e.proposed);
                      return (
                        <div key={e.id} className="text-xs">
                          <p className={st.color}>
                            {st.label}
                            {fields ? <span className="text-gray-500">: {fields}</span> : null}
                          </p>
                          {e.admin_comment && (
                            <p className="text-gray-400 break-words">Админ: {e.admin_comment}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {renamingId === r.id && (
                  <RenameForm
                    row={r}
                    onDone={(saved) => {
                      setRenamingId(null);
                      if (saved) {
                        setNotice("ФИО клиента обновлено.");
                        setTimeout(() => setNotice(null), 4000);
                      }
                    }}
                  />
                )}

                {(canRename || canEdit) && renamingId !== r.id && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-acid-400 active:opacity-70"
                      >
                        <Icon name="pencil" className="w-3.5 h-3.5" />
                        Предложить исправление
                      </button>
                    )}
                    {canRename && (
                      <button
                        type="button"
                        onClick={() => setRenamingId(r.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 active:opacity-70"
                      >
                        <Icon name="pencil" className="w-3.5 h-3.5" />
                        Изменить ФИО
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {rows.length > 0 && shown.length === 0 && (
        <EmptyState
          icon="receipt"
          title="Ничего не нашлось"
          hint="Такого клиента или дня среди оплат месяца нет."
          action={
            <button
              type="button"
              onClick={resetFilters}
              className="inline-block bg-acid-400 text-black font-bold rounded-xl px-5 py-2.5 text-sm active:scale-95"
            >
              Сбросить
            </button>
          }
        />
      )}
    </div>
  );
}
