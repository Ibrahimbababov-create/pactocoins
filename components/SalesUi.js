"use client";

import { useState } from "react";
import { mln, money } from "@/lib/sales/format";

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

// Цвета состояний (продал / в процессе / потеряно) — отдельно от цветов менеджеров
export const STATUS = { good: "#3fa66a", info: "#3987e5", warn: "#c98500", bad: "#e66767", none: "rgb(var(--c-dim))" };

// Источники: цвет закреплён за источником, а не за местом в списке
const SRC_COLORS = {
  "Таргет PinkBubble": "#3987e5",
  Instagram: "#d55181",
  "Reels чат-бот": "#199e70",
  Сторис: "#d95926",
  "Старая база": "#c98500",
  "Старая база с МК": "#9085e9",
  TikTok: "#008300",
  "Без UTM": "rgb(var(--c-dim))",
};
const SRC_EXTRA = ["#e66767", "#3987e5", "#d95926", "#199e70"];
export function sourceColor(name, i = 0) {
  return SRC_COLORS[name] || SRC_EXTRA[i % SRC_EXTRA.length];
}

// Кольцо: items [{ label, v, color }]; center — [крупно, мелко]; fmt — подпись значения
export function Donut({ items, center, fmt = (v) => v, label }) {
  const list = items.filter((i) => i.v > 0).sort((a, b) => b.v - a.v);
  const total = list.reduce((a, i) => a + i.v, 0);
  if (!total) return <Empty />;
  const R = 52;
  const C = 2 * Math.PI * R;
  const gap = list.length > 1 ? 2.5 : 0;
  let off = 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 140 140" className="w-36 h-36 shrink-0" role="img" aria-label={label}>
        <g transform="rotate(-90 70 70)">
        <circle cx="70" cy="70" r={R} fill="none" strokeWidth="16" style={{ stroke: "rgb(var(--c-line))" }} />
        {list.map((it) => {
          const len = (it.v / total) * C;
          const seg = (
            <circle
              key={it.label}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              strokeWidth="16"
              strokeDasharray={`${Math.max(len - gap, 0.5)} ${C}`}
              strokeDashoffset={-off}
              style={{ stroke: it.color }}
            >
              <title>{`${it.label}: ${fmt(it.v)} · ${Math.round((it.v / total) * 100)}%`}</title>
            </circle>
          );
          off += len;
          return seg;
        })}
        </g>
        <g>
          <text x="70" y="68" textAnchor="middle" fontSize="20" fontWeight="700" style={{ fill: "rgb(var(--c-text))", fontFamily: "var(--font-unbounded)" }}>
            {center[0]}
          </text>
          <text x="70" y="86" textAnchor="middle" fontSize="10" style={{ fill: "rgb(var(--c-muted))" }}>
            {center[1]}
          </text>
        </g>
      </svg>
      <ul className="w-full space-y-1.5 text-sm">
        {list.map((it) => (
          <li key={it.label} className="flex justify-between gap-3">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: it.color }} />
              <span className="truncate">{it.label}</span>
            </span>
            <span className="text-gray-400 shrink-0">
              {fmt(it.v)} · {Math.round((it.v / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Сплошная полоса из долей + подписи
export function StackBar({ items, total, fmt = (v) => v }) {
  const T = total || items.reduce((a, i) => a + i.v, 0) || 1;
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-dark-700 gap-0.5">
        {items
          .filter((i) => i.v > 0)
          .map((i) => (
            <span key={i.label} style={{ width: `${(i.v / T) * 100}%`, background: i.color }} title={`${i.label}: ${fmt(i.v)}`} />
          ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i.label} className="flex justify-between gap-3">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: i.color }} />
              <span className="truncate">{i.label}</span>
            </span>
            <span className="text-gray-400 shrink-0">
              {fmt(i.v)} · {Math.round((i.v / T) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Накопительная выручка по дням + пунктир «темп плана». Касание или наведение
// показывает день и сумму на эту дату.
export function CumChart({ cum, dim, plan, label, monthGen = "" }) {
  const [hover, setHover] = useState(null);
  const W = 320;
  const H = 130;
  const top = 10;
  const last = cum[cum.length - 1] || 0;
  if (!last && !plan) return <p className="text-sm text-gray-500 py-6 text-center">Оплат пока нет.</p>;
  const max = Math.max(plan || 0, last, 1);
  const x = (i) => (dim > 1 ? (i / (dim - 1)) * W : 0);
  const y = (v) => H - (v / max) * (H - top);
  const line = cum.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const lx = x(cum.length - 1);
  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const i = Math.round((cx / r.width) * (dim - 1));
    setHover(Math.max(0, Math.min(cum.length - 1, i)));
  };
  const h = hover != null ? hover : null;
  return (
    <div className="relative">
      <div className="absolute left-0 top-0 text-[10px] text-gray-500 tabular-nums pointer-events-none">{mln(max)}</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto overflow-visible touch-pan-y"
        role="img"
        aria-label={label}
        onMouseMove={pick}
        onTouchMove={pick}
        onTouchStart={pick}
        onMouseLeave={() => setHover(null)}
        onTouchEnd={() => setHover(null)}
      >
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1="0" x2={W} y1={y(max * g)} y2={y(max * g)} style={{ stroke: "rgb(var(--c-line))" }} strokeWidth="1" />
        ))}
        {plan > 0 && (
          <line x1="0" y1={y(plan / dim)} x2={W} y2={y(plan)} style={{ stroke: "rgb(var(--c-muted))" }} strokeWidth="1.2" strokeDasharray="4 4" />
        )}
        {cum.length > 0 && (
          <>
            <path d={`${line}L${lx},${H}L0,${H}Z`} style={{ fill: "rgb(var(--c-accent) / 0.14)" }} />
            <path d={line} fill="none" style={{ stroke: "rgb(var(--c-accent))" }} strokeWidth="2.2" strokeLinejoin="round" />
            <circle cx={lx} cy={y(last)} r="4" style={{ fill: "rgb(var(--c-accent))", stroke: "rgb(var(--c-card))" }} strokeWidth="2" />
          </>
        )}
        {h != null && (
          <>
            <line x1={x(h)} x2={x(h)} y1="0" y2={H} style={{ stroke: "rgb(var(--c-muted))" }} strokeWidth="1" />
            <circle cx={x(h)} cy={y(cum[h])} r="4" style={{ fill: "rgb(var(--c-text))" }} />
          </>
        )}
      </svg>
      {h != null && (
        <div
          className="absolute -top-2 -translate-x-1/2 bg-dark-900 border border-dark-600 rounded-lg px-2 py-1 text-xs whitespace-nowrap pointer-events-none"
          style={{ left: `${Math.min(85, Math.max(15, (x(h) / W) * 100))}%` }}
        >
          {h + 1} {monthGen} · <b className="tabular-nums">{money(cum[h])}</b>
          {plan > 0 && <span className="text-gray-500"> · план {mln((plan / dim) * (h + 1))}</span>}
        </div>
      )}
      <div className="flex justify-between text-[11px] text-gray-500 mt-1">
        <span className="tabular-nums">1</span>
        {plan > 0 && <span>пунктир — темп плана</span>}
        <span className="tabular-nums">{dim}</span>
      </div>
    </div>
  );
}
