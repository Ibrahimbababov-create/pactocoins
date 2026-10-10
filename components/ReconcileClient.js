"use client";

import { useState, useTransition } from "react";
import {
  sendReconcileReminders,
  saveProjectSheet,
  listTabsForLink,
  previewProjectSheet,
} from "@/app/admin/reconcileActions";

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

const fieldCls =
  "block w-16 mt-1 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-white uppercase";

function ColInput({ label, value, onChange, hint }) {
  return (
    <label className="text-[11px] text-gray-500">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
        maxLength={2}
        placeholder={hint}
        className={fieldCls}
      />
    </label>
  );
}

// Настройка таблицы проекта: ссылка → выбрать лист → колонки → проверить
// (сервер показывает, как понял строки) → сохранить.
function SheetEditor({ project, source, failed }) {
  const [link, setLink] = useState(
    source ? `https://docs.google.com/spreadsheets/d/${source.spreadsheetId}/edit` : ""
  );
  const [tabs, setTabs] = useState(null);
  const [layout, setLayout] = useState(source?.layout ?? "tabs");
  const [tab, setTab] = useState(source?.tab ?? "");
  const [nameCol, setNameCol] = useState(source?.nameCol != null ? col(source.nameCol) : "A");
  const [dateCol, setDateCol] = useState(
    source ? (source.dateCol != null ? col(source.dateCol) : "") : "B"
  );
  const [amountCol, setAmountCol] = useState(source ? col(source.amountCol) : "I");
  const [startRow, setStartRow] = useState(String(source?.startRow ?? 3));
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState(null);
  const [pending, start] = useTransition();

  const form = () => ({
    projectId: project.id,
    project: source?.project || project.name,
    link,
    layout,
    tab,
    nameCol,
    dateCol,
    amountCol,
    startRow,
  });

  function findTabs() {
    setMsg(null);
    start(async () => {
      const res = await listTabsForLink(project.id, link);
      if (res?.error) return setMsg({ error: res.error });
      setTabs(res.tabs);
    });
  }

  function check() {
    setMsg(null);
    setPreview(null);
    start(async () => {
      const res = await previewProjectSheet(form());
      if (res?.error) return setMsg({ error: res.error });
      if (!res.ok) return setMsg({ error: `Не получилось: ${res.reason}` });
      setPreview(res);
    });
  }

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveProjectSheet(form());
      setMsg(res?.error ? { error: res.error } : { ok: "Сохранено. Сверка пересчитается." });
    });
  }

  const tabOptions = tabs ?? (source?.tab ? [source.tab] : []);

  return (
    <div className="rounded-xl border border-dark-600 bg-dark-900/40 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{project.name}</p>
        {!source && <span className="text-[11px] text-gray-500">таблица не указана</span>}
        {source && failed && <span className="text-[11px] text-amber-400">не открылась</span>}
      </div>

      <div className="flex gap-2">
        <input
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setTabs(null);
            setPreview(null);
          }}
          placeholder="Ссылка на Google-таблицу"
          className="flex-1 min-w-0 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          onClick={findTabs}
          disabled={pending || !link.trim()}
          className="shrink-0 border border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-300 disabled:opacity-50"
        >
          Найти листы
        </button>
      </div>

      <label className="block text-[11px] text-gray-500">
        Какие листы считать
        <select
          value={layout === "tabs" ? "__tabs__" : tab}
          onChange={(e) => {
            setPreview(null);
            if (e.target.value === "__tabs__") {
              setLayout("tabs");
            } else {
              setLayout("sheet");
              setTab(e.target.value);
            }
          }}
          className="block w-full mt-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="__tabs__">Каждый лист: отдельный менеджер</option>
          {tabOptions.map((t) => (
            <option key={t} value={t}>
              Лист «{t}»: все продажи тут
            </option>
          ))}
        </select>
        {!tabs && !source?.tab && (
          <span className="block mt-1 text-gray-600">
            Нажми «Найти листы», чтобы выбрать конкретный лист.
          </span>
        )}
      </label>

      <div className="flex flex-wrap items-end gap-3">
        {layout === "sheet" && (
          <ColInput label="Имя" value={nameCol} onChange={setNameCol} hint="A" />
        )}
        <ColInput
          label={layout === "sheet" ? "Дата (если есть)" : "Дата"}
          value={dateCol}
          onChange={setDateCol}
          hint="B"
        />
        <ColInput label="Сумма" value={amountCol} onChange={setAmountCol} hint="I" />
        <label className="text-[11px] text-gray-500">
          Данные со строки
          <input
            value={startRow}
            onChange={(e) => setStartRow(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            className="block w-16 mt-1 bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-sm text-white"
          />
        </label>
      </div>
      {layout === "sheet" && !dateCol && (
        <p className="text-[11px] text-gray-500">
          Без колонки даты весь лист считается за текущий месяц.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={check}
          disabled={pending || !link.trim()}
          className="flex-1 border border-dark-600 rounded-lg py-2 text-sm text-gray-300 disabled:opacity-50"
        >
          Проверить
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending || !link.trim()}
          className="flex-1 bg-acid-400 text-black font-bold rounded-lg py-2 text-sm disabled:opacity-50"
        >
          Сохранить
        </button>
      </div>

      {preview && (
        <div className="rounded-lg border border-dark-600 p-2 text-xs space-y-1">
          <p className="text-gray-400">
            За этот месяц: строк {preview.count} · людей {preview.people} · сумма{" "}
            {kzt(preview.total)}
            {preview.otherMonths > 0 && ` (ещё ${preview.otherMonths} строк за другие месяцы не считаю)`}
          </p>
          {preview.sample.length === 0 && (
            <p className="text-amber-400">
              Ни одной строки с суммой. Проверь колонки и строку начала.
            </p>
          )}
          {preview.sample.map((r, i) => (
            <div key={i} className="flex justify-between gap-2 text-gray-300 tabular-nums">
              <span className="truncate">{r.name}</span>
              <span className="shrink-0 text-gray-500">{r.day.split("-").reverse().join(".")}</span>
              <span className="shrink-0">{kzt(r.amount)}</span>
            </div>
          ))}
        </div>
      )}
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
              Таблица поменялась? Вставь ссылку, нажми «Найти листы», выбери лист и буквы
              колонок, потом «Проверить» и «Сохранить». Доступ к таблице: «Все, у кого есть
              ссылка».
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
                    {r.user && r.user.name !== r.sheetName && ` · в таблице «${r.sheetName}»`}
                  </p>
                  {!r.user && (
                    <p className="text-xs text-amber-400 mt-0.5">
                      {r.ambiguous.length
                        ? `Не понял, кто это: ${r.ambiguous.join(", ")}`
                        : "Не нашёл в PactoCoins. Напиши имя в таблице как в приложении"}
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
