"use client";

import { useMemo, useState, useTransition } from "react";
import { assignMopToMe, unassignMop, graduateTrainee } from "@/app/mop/actions";
import Icon from "@/components/Icon";
import { plural } from "@/lib/plural";
import { DayBars, Sparkline, DeltaChip, kzt, kztShort, statusOf } from "@/components/TeamViz";
import { QUIET_DAYS } from "@/lib/teamConstants";

function TraineeProgress({ ob }) {
  if (!ob) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {[1, 2, 3].map((d) => {
        const done = ob.done?.[d] ?? 0;
        const total = ob.total?.[d] ?? 0;
        const full = total > 0 && done >= total;
        return (
          <span
            key={d}
            className={`inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full border ${
              full
                ? "bg-acid-400/15 text-acid-400 border-acid-400/30"
                : "bg-dark-700 text-gray-500 border-dark-600"
            }`}
          >
            День {d}: {done}/{total}
            {full && <Icon name="check" className="w-3 h-3" strokeWidth={2.5} />}
          </span>
        );
      })}
    </div>
  );
}

const TONE = {
  acid: "bg-acid-400/15 text-acid-400",
  warn: "bg-amber-500/15 text-amber-400",
  sky: "bg-sky-500/15 text-sky-300",
  muted: "bg-dark-700 text-gray-400",
};

function initials(name) {
  const parts = String(name ?? "?").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

const SORTS = [
  { key: "month", label: "По месяцу" },
  { key: "week", label: "По неделе" },
  { key: "quiet", label: "Кто молчит" },
  { key: "name", label: "По имени" },
];

export default function TeamManageClient({ overview, others = [], watching = false, onboarding = {} }) {
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState(null);
  const [pick, setPick] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("month");
  const [q, setQ] = useState("");

  const people = useMemo(
    () =>
      overview.people.map((m) => ({
        ...m,
        status: statusOf(m, QUIET_DAYS),
        onboarding: onboarding[m.id] ?? null,
      })),
    [overview.people, onboarding]
  );

  const topMonth = Math.max(...people.map((m) => m.month_kzt), 1);
  const paidThisMonth = people.filter((m) => m.month_kzt > 0).length;
  const trainees = people.filter((m) => m.role === "trainee").length;
  const quietCount = people.filter((m) => m.status.key === "quiet").length;
  const todayCount = people.filter((m) => m.status.key === "today").length;

  const weekTop = [...people]
    .filter((m) => m.week_kzt > 0)
    .sort((a, b) => b.week_kzt - a.week_kzt)
    .slice(0, 3);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = people.filter((m) => {
      if (needle && !m.name.toLowerCase().includes(needle)) return false;
      if (filter === "today") return m.status.key === "today";
      if (filter === "quiet") return m.status.key === "quiet";
      if (filter === "trainee") return m.role === "trainee";
      return true;
    });
    const by = {
      month: (a, b) => b.month_kzt - a.month_kzt,
      week: (a, b) => b.week_kzt - a.week_kzt || b.month_kzt - a.month_kzt,
      quiet: (a, b) => (b.days_since_paid ?? 999) - (a.days_since_paid ?? 999),
      name: (a, b) => a.name.localeCompare(b.name, "ru"),
    }[sort];
    list = [...list].sort(by);
    return list;
  }, [people, filter, sort, q]);

  function add() {
    if (!pick) return;
    setMsg(null);
    start(async () => {
      const res = await assignMopToMe(pick);
      setMsg(res?.error || "Добавлен");
      if (!res?.error) setPick("");
    });
  }

  function graduate(id, name) {
    if (!window.confirm(`Допустить ${name}? Стажёр станет МОПом 1 уровня. Отменить нельзя.`)) return;
    setMsg(null);
    start(async () => {
      const res = await graduateTrainee(id);
      setMsg(res?.error || `${name} допущен, теперь МОП`);
    });
  }

  function remove(id, name) {
    if (!window.confirm(`Убрать ${name} из команды?`)) return;
    setMsg(null);
    start(async () => {
      const res = await unassignMop(id);
      setMsg(res?.error || "Убран");
    });
  }

  const chips = [
    { key: "all", label: "Все", n: people.length },
    { key: "today", label: "Сегодня с оплатой", n: todayCount },
    { key: "quiet", label: "Молчат", n: quietCount },
    ...(trainees > 0 ? [{ key: "trainee", label: "Стажёры", n: trainees }] : []),
  ];

  return (
    <div className="space-y-5">
      {people.length > 0 && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Выручка команды · {overview.monthLabel}</p>
          <p className="font-display text-3xl font-bold tabular-nums mt-1">{kzt(overview.total)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <DeltaChip now={overview.total} before={overview.prevSame} label="к прошлому месяцу" />
            {overview.prevSame > 0 && (
              <span className="text-xs text-gray-500">за те же дни</span>
            )}
          </div>

          <div className="mt-4">
            <DayBars days={overview.days} values={overview.teamSeries} />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>{overview.days[0].label}</span>
              <span>сегодня</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-xl bg-dark-700/60 px-3 py-2">
              <p className="text-[11px] text-gray-500">Сегодня</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">{kztShort(overview.today)}</p>
            </div>
            <div className="rounded-xl bg-dark-700/60 px-3 py-2">
              <p className="text-[11px] text-gray-500">Неделя</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">{kztShort(overview.week)}</p>
            </div>
            <div className="rounded-xl bg-dark-700/60 px-3 py-2">
              <p className="text-[11px] text-gray-500">С оплатами</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">
                {paidThisMonth} из {people.length}
              </p>
            </div>
          </div>

          {overview.pending > 0 && (
            <p className="text-xs text-amber-400 mt-3">
              Ждут одобрения: {overview.pending}{" "}
              {plural(overview.pending, "заявка", "заявки", "заявок")}
            </p>
          )}
        </div>
      )}

      {overview.quiet.length > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
          <p className="text-sm font-semibold">
            Неделю без оплат: {overview.quiet.length}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Хороший повод написать или созвониться</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {overview.quiet.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setFilter("quiet");
                  setQ("");
                }}
                className="text-xs rounded-full bg-dark-800 border border-dark-600 px-2.5 py-1 text-gray-200"
              >
                {m.name}
                <span className="text-amber-400">
                  {" "}
                  · {m.days == null ? "давно" : `${m.days} дн.`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {weekTop.length > 0 && (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Icon name="trophy" className="w-4 h-4 text-acid-400" />
            <p className="text-sm font-semibold">Топ недели в команде</p>
          </div>
          <div className="mt-3 space-y-2.5">
            {weekTop.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? "bg-acid-400 text-black" : "bg-dark-700 text-gray-300"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm">{m.name}</span>
                <span className="text-sm font-bold tabular-nums">{kztShort(m.week_kzt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <p className="text-xs text-gray-400">В команде ({people.length})</p>
          {people.length > 1 && (
            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              <span>Порядок</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-dark-700 border border-dark-600 rounded-lg px-2 py-1 text-xs text-white"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {people.length > 1 && (
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                className={`shrink-0 text-xs rounded-full border px-3 py-1.5 transition ${
                  filter === c.key
                    ? "bg-acid-400 text-black border-acid-400 font-semibold"
                    : "bg-dark-800 border-dark-600 text-gray-400"
                }`}
              >
                {c.label} {c.n}
              </button>
            ))}
          </div>
        )}

        {people.length > 5 && (
          <div className="relative">
            <Icon name="search" className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Найти по имени"
              className="w-full bg-dark-800 border border-dark-600 rounded-xl pl-9 pr-3 py-2 text-sm text-white"
            />
          </div>
        )}

        {people.length === 0 && (
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 text-center">
            <Icon name="users" className="w-8 h-8 text-gray-500 mx-auto" />
            <p className="font-semibold mt-3">В команде пока никого</p>
            <p className="text-sm text-gray-400 mt-1">
              Добавь своих МОПов ниже, и здесь появятся их оплаты, динамика и кто просел.
            </p>
          </div>
        )}

        {people.length > 0 && shown.length === 0 && (
          <p className="text-sm text-gray-500 py-4 text-center">
            Никого не нашли. Сбрось фильтр или поиск.
          </p>
        )}

        {shown.map((m) => {
          const st = m.status;
          const pct = Math.round((m.month_kzt / topMonth) * 100);
          return (
            <div key={m.id} className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-full bg-dark-700 border border-dark-600 flex items-center justify-center text-sm font-bold text-acid-400 shrink-0">
                  {initials(m.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold truncate">{m.name}</p>
                    <span className={`shrink-0 text-[11px] font-semibold rounded-full px-2 py-0.5 ${TONE[st.tone]}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="font-display text-xl font-bold tabular-nums mt-1">
                    {kzt(m.month_kzt)}
                  </p>
                  <p className="text-xs text-gray-500 tabular-nums">
                    за месяц
                    {m.month_deals > 0 &&
                      ` · ${m.month_deals} ${plural(m.month_deals, "оплата", "оплаты", "оплат")}`}
                  </p>
                </div>
              </div>

              <div className="h-1 rounded-full bg-dark-600 overflow-hidden mt-3">
                <div className="h-full rounded-full bg-acid-400/70" style={{ width: `${pct}%` }} />
              </div>

              <div className="flex items-end gap-4 mt-3">
                <div className="flex-1 min-w-0">
                  <Sparkline values={m.series} className="w-full h-8" />
                  <p className="text-[10px] text-gray-600 mt-0.5">последние 14 дней</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">{kztShort(m.week_kzt)}</p>
                  <p className="text-[11px] text-gray-500">за неделю</p>
                </div>
              </div>

              {m.pending > 0 && (
                <p className="text-xs text-amber-400 mt-2">Ждёт одобрения: {m.pending}</p>
              )}

              {m.role === "trainee" && <TraineeProgress ob={m.onboarding} />}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-700">
                {m.role === "trainee" ? (
                  <button
                    onClick={() => graduate(m.id, m.name)}
                    disabled={isPending || watching}
                    className="flex items-center gap-1 text-xs font-bold bg-acid-400 text-black rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    <Icon name="award" className="w-3.5 h-3.5" />
                    Допустить
                  </button>
                ) : (
                  <span />
                )}
                <button
                  onClick={() => remove(m.id, m.name)}
                  disabled={isPending || watching}
                  className="text-xs text-gray-500 px-2 py-1 disabled:opacity-50"
                >
                  Убрать из команды
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!watching && (
        <details className="bg-dark-800 border border-dark-600 rounded-2xl p-4 group">
          <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold">
            Добавить в команду
            <Icon name="chevronDown" className="w-4 h-4 text-gray-500 transition group-open:rotate-180" />
          </summary>
          <div className="space-y-3 mt-3">
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="">Выбери МОПа…</option>
              {others.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.rop_id ? " (уже у другого РОПа)" : ""}
                </option>
              ))}
            </select>
            <button
              onClick={add}
              disabled={isPending || !pick}
              className="w-full bg-acid-400 text-black font-bold rounded-lg py-2 text-sm disabled:opacity-50"
            >
              Добавить
            </button>
          </div>
        </details>
      )}

      {msg && <p className="text-sm text-acid-400">{msg}</p>}
    </div>
  );
}
