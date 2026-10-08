"use client";

import { mln } from "@/lib/sales/format";

// Общие кусочки экранов аналитики.

// Цвета менеджеров на графиках. Палитра проверена на различимость (в т.ч. при
// дальтонизме) на тёмном фоне всех тем сайта. Цвет закреплён за человеком по
// алфавиту (view.people), а не по месту в рейтинге; девятый и дальше — серые.
const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
export function colorFor(name, people) {
  const i = people.indexOf(name);
  return i >= 0 && i < SERIES.length ? SERIES[i] : "rgb(var(--c-dim))";
}

export function Card({ children, className = "" }) {
  return <section className={`bg-dark-800 border border-dark-700 rounded-2xl p-4 ${className}`}>{children}</section>;
}

export function CardTitle({ children, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-3">
      <h2 className="font-semibold">{children}</h2>
      {hint && <span className="text-xs text-gray-500 text-right">{hint}</span>}
    </div>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-display font-semibold text-[15px] tabular-nums truncate">{value}</dd>
      {sub && <dd className="text-xs text-gray-500">{sub}</dd>}
    </div>
  );
}

export function Empty({ children = "Нет данных за этот месяц." }) {
  return <p className="text-sm text-gray-500">{children}</p>;
}

// Горизонтальные полоски: items [{ k, s, n?, color? }], value — подпись справа
export function Bars({ items, value = (it) => `${it.n} · ${mln(it.s)}`, measure = (it) => it.s }) {
  if (!items.length) return <Empty />;
  const mx = Math.max(1, ...items.map(measure));
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.k} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="truncate flex items-center gap-2">
              {it.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: it.color }} />}
              {it.k}
            </span>
            <span className="text-gray-400 shrink-0">{value(it)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-dark-700 mt-1 overflow-hidden">
            <span
              className="block h-full rounded-full"
              style={{ width: `${(measure(it) / mx) * 100}%`, background: it.color || "rgb(var(--c-accent) / 0.7)" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// shown — кого показать, all — полный список (по нему закреплены цвета)
export function Legend({ shown, all }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
      {shown.map((p) => (
        <span key={p} className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full" style={{ background: colorFor(p, all) }} />
          {p}
        </span>
      ))}
    </div>
  );
}

// Кнопки-фильтры в один ряд
export function Chips({ options, value, onChange, label }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" role="group" aria-label={label}>
      {options.map(([k, l]) => (
        <button
          key={k}
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs border ${
            value === k ? "bg-acid-400/15 border-acid-400/40 text-acid-400 font-semibold" : "border-dark-700 text-gray-400"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
