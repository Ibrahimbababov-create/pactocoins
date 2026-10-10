"use client";

import { useState, useTransition } from "react";
import { sendReconcileReminders, saveProjectSheet } from "@/app/admin/reconcileActions";

const kzt = (n) => `${Math.round(Number(n) || 0).toLocaleString("ru-RU")} ₸`;
const col = (i) => {
  let n = Number(i) + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

function SheetEditor({ project, source, failed, onSaved }) {
  const [link, setLink] = useState(
    source ? `https://docs.google.com/spreadsheets/d/${source.spreadsheetId}/edit` : ""
  );
  const [dateCol, setDateCol] = useState(source ? col(source.dateCol) : "B");
  const [amountCol, setAmountCol] = useState(source ? col(source.amountCol) : "I");
  const [msg, setMsg] = useState(null);
  const [pending, start] = useTransition();

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveProjectSheet({
        projectId: project.id,
        project: source?.project || project.name,
        link,
        dateCol,
        amountCol,
      });
      setMsg(res?.error ? { error: res.error } : { ok: "Сохранено" });
      if (!res?.error) onSaved?.();
    });
  }

  return (
    <div className="rounded-xl border border-dark-600 bg-dark-900/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{project.name}</p>
        {!source && <span className="text-[11px] text-gray-500">таблица не указана</span>}
        {source && failed && <span className="text-[11px] text-amber-400">не открылась</span>}
      </div>
      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="Ссылка на Google-таблицу этого месяца"
        className="w-full min-w-0 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white"
      />
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-gray-500">
          Колонка даты
          <input
            value={dateCol}
            onChange={(e) => setDateCol(e.target.value.toUpperCase())}
            maxLength={2}
            className="block w-16 mt-1 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-white uppercase"
          />
        </label>
        <label className="text-[11px] text-gray-500">
          Колонка суммы
          <input
            value={amountCol}
            onChange={(e) => setAmountCol(e.target.value.toUpperCase())}
            maxLength={2}
            className="block w-16 mt-1 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-white uppercase"
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={pending || !link.trim()}
          className="ml-auto bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          Сохранить
        </button>
      </div>
      {msg?.error && <p className="text-xs text-red-400">{msg.error}</p>}
      {msg?.ok && <p className="text-xs text-acid-400">{msg.ok}</p>}
    </div>
  );
}

export default function ReconcileClient({ monthKey, data, projects, isAdmin }) {
  const [pending, start] = useTransition();
  const [reminded, setReminded] = useState(() => new Set());
  const [msg, setMsg] = useState(null);
  const failed = new Set(data.failedSheets ?? []);
  const sourceByProject = Object.fromEntries((data.sources ?? []).map((s) => [s.projectId, s]));
  const [editorOpen, setEditorOpen] = useState(
    () => !data.ok || (data.sources ?? []).length === 0 || failed.size > 0
  );

  const remindable = data.rows.filter(
    (r) => r.user?.hasTelegram && r.missing >= 5000 && !reminded.has(r.user.id)
  );

  function remind(userIds) {
    const count = userIds.length || remindable.length;
    if (!count) return;
    if (!window.confirm(`Отправить напоминание в личку: ${count} чел.?`)) return;
    setMsg(null);
    start(async () => {
      const res = await sendReconcileReminders(monthKey, userIds);
      if (res?.error) {
        setMsg({ error: res.error });
        return;
      }
      const ids = userIds.length ? userIds : remindable.map((r) => r.user.id);
      setReminded((prev) => new Set([...prev, ...ids]));
      setMsg({ ok: `Отправлено: ${res.sent}` });
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3">
        <button
          type="button"
          onClick={() => setEditorOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 text-left"
          aria-expanded={editorOpen}
        >
          <span className="font-semibold">Таблицы месяца</span>
          <span className="text-xs text-gray-500">{editorOpen ? "Свернуть" : "Изменить"}</span>
        </button>
        {editorOpen && (
          <>
            <p className="text-xs text-gray-500">
              Каждый месяц вставляй сюда ссылку на новую таблицу проекта. Таблица должна
              открываться по ссылке. Вкладка = менеджер, данные с 3-й строки.
            </p>
            {projects.length === 0 && (
              <p className="text-sm text-gray-500">
                {isAdmin ? "Активных проектов нет." : "За тобой не закреплён ни один проект."}
              </p>
            )}
            {projects.map((p) => (
              <SheetEditor
                key={p.id}
                project={p}
                source={sourceByProject[p.id]}
                failed={sourceByProject[p.id] && failed.has(sourceByProject[p.id].project)}
              />
            ))}
          </>
        )}
      </div>

      {!data.ok && (data.sources ?? []).length > 0 && (
        <p className="text-sm text-amber-400">
          Таблицы не открылись. Проверь ссылку и доступ «по ссылке» выше.
        </p>
      )}

      {data.rows.length > 0 && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <p className="text-xs text-gray-500">{data.monthLabel}</p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <p>
              В таблицах: <b className="tabular-nums">{kzt(data.totals.sheet)}</b>
            </p>
            <p>
              В PactoCoins: <b className="tabular-nums">{kzt(data.totals.app)}</b>
            </p>
            <p className={data.totals.missing > 0 ? "text-amber-400" : "text-acid-400"}>
              Не записано: <b className="tabular-nums">{kzt(data.totals.missing)}</b>
            </p>
          </div>
          {remindable.length > 0 && (
            <button
              type="button"
              onClick={() => remind([])}
              disabled={pending}
              className="mt-3 w-full bg-acid-400 text-black font-bold rounded-xl py-2.5 text-sm disabled:opacity-50"
            >
              Напомнить всем, у кого разница ({remindable.length})
            </button>
          )}
          {msg?.error && <p className="text-xs text-red-400 mt-2">{msg.error}</p>}
          {msg?.ok && <p className="text-xs text-acid-400 mt-2">{msg.ok}</p>}
        </div>
      )}

      {data.ok && data.rows.length === 0 && (
        <p className="text-sm text-gray-500">За этот месяц в таблицах нет продаж.</p>
      )}

      <div className="space-y-2">
        {data.rows.map((r) => {
          const recorded = r.approved + r.pending;
          const canRemind = r.user?.hasTelegram && r.missing >= 5000;
          return (
            <div
              key={`${r.project}|${r.sheetName}`}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{r.user?.name ?? r.sheetName}</p>
                  <p className="text-xs text-gray-500">
                    {r.project}
                    {r.user && r.user.name !== r.sheetName && ` · во вкладке «${r.sheetName}»`}
                  </p>
                  {!r.user && (
                    <p className="text-xs text-amber-400 mt-0.5">
                      {r.ambiguous.length
                        ? `Не понял, кто это: ${r.ambiguous.join(", ")}`
                        : "Не нашёл в PactoCoins — переименуй вкладку как в приложении"}
                    </p>
                  )}
                </div>
                {r.missing > 0 ? (
                  <span className="shrink-0 text-sm font-bold text-amber-400 tabular-nums">
                    −{kzt(r.missing)}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-acid-400">всё записано</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2 tabular-nums">
                таблица {kzt(r.sheetKzt)} · PactoCoins {kzt(recorded)}
                {r.pending > 0 && ` (ждёт одобрения ${kzt(r.pending)})`}
              </p>
              {canRemind && (
                <button
                  type="button"
                  onClick={() => remind([r.user.id])}
                  disabled={pending || reminded.has(r.user.id)}
                  className="mt-2 text-xs font-semibold text-acid-400 disabled:text-gray-500"
                >
                  {reminded.has(r.user.id) ? "Напомнил" : "Напомнить в личку"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
