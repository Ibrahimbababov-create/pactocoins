"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import { money, mln, plural } from "@/lib/sales/format";

// Экраны раздела «Аналитика»: Сводка, Менеджеры, страница менеджера.
// Все цифры уже посчитаны на сервере (lib/sales/metrics.js) — тут только вид.

const FILTERS = [
  ["all", "Все"],
  ["course", "Курс"],
  ["int", "Интенсив"],
];
const BIG_LABEL = {
  all: "Выручка отдела за месяц",
  course: "Выручка по курсу за месяц",
  int: "Выручка по интенсивам за месяц",
};

const firstWord = (s) => String(s || "").trim().split(/\s+/)[0].toLowerCase().replace(/ё/g, "е");
const isMe = (name, meName) => !!meName && firstWord(name) === firstWord(meName);

function tone(pct, need) {
  if (pct == null) return "text-gray-500";
  if (pct >= need) return "text-acid-400";
  if (pct >= need * 0.6) return "text-amber-400";
  return "text-red-400";
}

export default function SalesDashboard({
  basePath,
  departments,
  deptId,
  months,
  view,
  lead,
  meName,
  notice,
}) {
  const router = useRouter();
  const [tab, setTab] = useState("summary");
  const [mgr, setMgr] = useState(null);

  const go = (params) => {
    const q = new URLSearchParams({ dept: deptId, ...(view ? { month: view.key } : {}), ...params });
    setMgr(null);
    router.push(`${basePath}?${q}`);
  };
  const pickDept = (id) => {
    try {
      document.cookie = `sales_dept=${id}; path=/; max-age=31536000; samesite=lax`;
    } catch {}
    const q = new URLSearchParams({ dept: id });
    setMgr(null);
    router.push(`${basePath}?${q}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-display font-bold mr-auto">Аналитика</h1>
        {departments.length > 1 && (
          <Select
            id="sales-dept"
            label="Отдел"
            value={deptId}
            onChange={pickDept}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
          />
        )}
        {months.length > 0 && (
          <Select
            id="sales-month"
            label="Месяц"
            value={view?.key}
            onChange={(k) => go({ month: k })}
            options={months.map((m) => ({ value: m.key, label: m.label }))}
          />
        )}
      </div>
      {departments.length === 1 && (
        <p className="text-sm text-gray-500 -mt-2">{departments[0].name}</p>
      )}

      {notice ? (
        <div className="bg-dark-800 border border-dark-700 rounded-2xl">
          <EmptyState icon="chart" title={notice.title} hint={notice.hint} />
        </div>
      ) : mgr && view.perManager[mgr] ? (
        <ManagerPage
          view={view}
          name={mgr}
          lead={lead}
          meName={meName}
          onBack={() => setMgr(null)}
        />
      ) : (
        <>
          <div className="flex gap-1 bg-dark-800 border border-dark-700 rounded-xl p-1 w-fit" role="tablist">
            {[
              ["summary", "Сводка"],
              ["managers", "Менеджеры"],
            ].map(([k, l]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`px-3.5 py-1.5 rounded-lg text-sm transition ${
                  tab === k ? "bg-acid-400/15 text-acid-400 font-semibold" : "text-gray-400"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          {tab === "summary" ? (
            <Summary view={view} meName={meName} onOpen={setMgr} />
          ) : (
            <Managers view={view} meName={meName} onOpen={setMgr} />
          )}
        </>
      )}
    </div>
  );
}

function Select({ id, label, value, onChange, options }) {
  return (
    <label htmlFor={id} className="relative">
      <span className="sr-only">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-dark-800 border border-dark-700 rounded-lg pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:border-acid-400"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevronDown"
        className="w-4 h-4 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
      />
    </label>
  );
}

function Card({ children, className = "" }) {
  return <section className={`bg-dark-800 border border-dark-700 rounded-2xl p-4 ${className}`}>{children}</section>;
}

function CardTitle({ children, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-3">
      <h2 className="font-semibold">{children}</h2>
      {hint && <span className="text-xs text-gray-500 text-right">{hint}</span>}
    </div>
  );
}

// Накопительная выручка по дням + пунктир «темп плана»
function CumChart({ cum, dim, plan, label }) {
  const W = 320;
  const H = 120;
  const top = 8;
  const last = cum[cum.length - 1] || 0;
  if (!last && !plan) return <p className="text-sm text-gray-500 py-6 text-center">Оплат пока нет.</p>;
  const max = Math.max(plan || 0, last, 1);
  const x = (i) => (dim > 1 ? (i / (dim - 1)) * W : 0);
  const y = (v) => H - (v / max) * (H - top);
  const line = cum.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const lx = x(cum.length - 1);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible" role="img" aria-label={label}>
        {[0.5, 1].map((g) => (
          <line key={g} x1="0" x2={W} y1={y(max * g)} y2={y(max * g)} style={{ stroke: "rgb(var(--c-line))" }} strokeWidth="1" />
        ))}
        {plan > 0 && (
          <line
            x1="0"
            y1={y(plan / dim)}
            x2={W}
            y2={y(plan)}
            style={{ stroke: "rgb(var(--c-muted))" }}
            strokeWidth="1.2"
            strokeDasharray="4 4"
          />
        )}
        {cum.length > 0 && (
          <>
            <path d={`${line}L${lx},${H}L0,${H}Z`} style={{ fill: "rgb(var(--c-accent) / 0.12)" }} />
            <path d={line} fill="none" style={{ stroke: "rgb(var(--c-accent))" }} strokeWidth="2.2" strokeLinejoin="round" />
            <circle cx={lx} cy={y(last)} r="3.5" style={{ fill: "rgb(var(--c-accent))" }} />
          </>
        )}
      </svg>
      <div className="flex justify-between text-[11px] text-gray-500 mt-1">
        <span className="tabular-nums">1</span>
        {plan > 0 && <span>пунктир — темп плана</span>}
        <span className="tabular-nums">{dim}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-display font-semibold text-[15px] tabular-nums truncate">{value}</dd>
      {sub && <dd className="text-xs text-gray-500">{sub}</dd>}
    </div>
  );
}

function Summary({ view, meName, onOpen }) {
  const [f, setF] = useState("all");
  const cur = view.filters[f];
  const fr = view.frac;
  const deltas = [];
  if (cur.delta != null)
    deltas.push(
      <span key="d">
        <b className={cur.delta >= 0 ? "text-acid-400" : "text-red-400"}>
          {cur.delta >= 0 ? "+" : ""}
          {cur.delta}%
        </b>{" "}
        к {fr.isCur ? "тому же дню прошлого месяца" : "прошлому месяцу"}
      </span>
    );
  if (f !== "int" && view.plan)
    deltas.push(
      <span key="p">
        <b className={tone(view.planPct, view.paceNeed)}>{view.planPct}%</b> плана {mln(view.plan)}
      </span>
    );
  const allFunnels = view.funnels.reduce((a, x) => a + x.v, 0) || 1;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-sm text-gray-500">{BIG_LABEL[f]}</p>
          <div className="flex gap-1 bg-dark-900/60 rounded-lg p-0.5" role="group" aria-label="Что считать">
            {FILTERS.map(([k, l]) => (
              <button
                key={k}
                aria-pressed={f === k}
                onClick={() => setF(k)}
                className={`px-2.5 py-1 rounded-md text-xs ${f === k ? "bg-dark-700 text-white font-semibold" : "text-gray-500"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <p className="font-display font-bold text-[34px] leading-none tabular-nums">
          {money(cur.total).replace(" ₸", "")}
          <span className="text-lg text-gray-500 ml-1">₸</span>
        </p>
        <p className="text-sm text-gray-400 mt-2 flex flex-wrap gap-x-2">
          {deltas.length
            ? deltas.reduce((acc, el, i) => (i ? [...acc, <span key={"s" + i}>·</span>, el] : [el]), [])
            : " "}
        </p>
        {view.planInherited && f !== "int" && (
          <p className="text-xs text-amber-400 mt-1">План за этот месяц ещё не внесён — взят план прошлого месяца.</p>
        )}
        <div className="mt-4">
          <CumChart
            cum={cur.cum}
            dim={fr.dim}
            plan={f === "int" ? 0 : view.plan}
            label="Выручка с начала месяца по дням"
          />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 pt-4 border-t border-dark-700">
          <Stat label="Оплаты" value={cur.count} />
          {fr.isCur && cur.forecast != null ? (
            <Stat label="Прогноз на месяц" value={mln(cur.forecast)} />
          ) : (
            <Stat label="Чистыми после комиссий" value={mln(cur.net)} />
          )}
          <Stat
            label="Конверсия лид → продажа"
            value={view.conversion != null ? `${String(view.conversion).replace(".", ",")}%` : "—"}
            sub={view.leads ? `${view.sales} из ${view.leads} лидов` : "лиды не внесены"}
          />
          <Stat label="Средний чек" value={cur.count ? mln(cur.avg) : "—"} />
        </dl>
      </Card>

      <Card>
        <CardTitle hint={fr.isCur ? `прошло ${view.paceNeed}% месяца` : null}>Менеджеры</CardTitle>
        <ManagerRulers view={view} meName={meName} onOpen={onOpen} />
      </Card>

      {view.insights.length > 0 && (
        <Card>
          <CardTitle>Что важно</CardTitle>
          <ul className="space-y-2.5">
            {view.insights.map(([kind, text], i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                    kind === "ok" ? "bg-acid-400" : kind === "warn" ? "bg-amber-400" : "bg-red-400"
                  }`}
                />
                <span className="text-gray-300">{text}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Курс и интенсив</CardTitle>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-dark-700">
            {view.funnels.map((x, i) =>
              x.v ? (
                <span
                  key={x.label}
                  style={{ width: `${(x.v / allFunnels) * 100}%` }}
                  className={i ? "bg-acid-400/40" : "bg-acid-400"}
                />
              ) : null
            )}
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            {view.funnels.map((x, i) => (
              <div key={x.label} className="flex justify-between gap-3">
                <dt className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${i ? "bg-acid-400/40" : "bg-acid-400"}`} />
                  {x.label}
                </dt>
                <dd className="tabular-nums text-gray-400">
                  {mln(x.v)} · {Math.round((x.v / allFunnels) * 100)}%
                </dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <CardTitle>Тарифы курса</CardTitle>
          <dl className="grid grid-cols-2 gap-3">
            {view.tariffs.map((t) => (
              <div key={t.label} className="bg-dark-900/50 rounded-xl p-3">
                <dt className="text-xs text-gray-500">{t.label}</dt>
                <dd className="font-display font-semibold text-xl tabular-nums">{t.n}</dd>
                <dd className="text-xs text-gray-500 tabular-nums">{mln(t.s)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}

function MeChip() {
  return <span className="text-[10px] font-semibold text-acid-400 bg-acid-400/10 rounded px-1.5 py-0.5">вы</span>;
}

function ManagerRulers({ view, meName, onOpen }) {
  const list = view.managers.filter((m) => m.plan > 0 || m.n > 0 || m.ints > 0);
  if (!list.length) return <p className="text-sm text-gray-500">Оплат пока нет.</p>;
  return (
    <ul className="divide-y divide-dark-700 -my-1">
      {list.map((m) => (
        <li key={m.name}>
          <button onClick={() => onOpen(m.name)} className="w-full text-left py-3 active:opacity-60">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{m.name}</span>
                {isMe(m.name, meName) && <MeChip />}
              </span>
              <span className={`font-display font-semibold tabular-nums text-sm ${tone(m.pct, view.paceNeed)}`}>
                {m.pct == null ? "без плана" : `${m.pct}%`}
              </span>
            </div>
            {m.plan > 0 && (
              <div className="relative h-1.5 rounded-full bg-dark-700 mt-2 overflow-hidden">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-acid-400"
                  style={{ width: `${Math.min(100, (m.s / m.plan) * 100)}%` }}
                />
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1.5">
              {m.n} {plural(m.n, "продажа", "продажи", "продаж")} · {mln(m.s)}
              {m.plan ? ` из ${mln(m.plan)}` : ""}
              {m.ints ? ` · ${m.ints} интенс.` : ""}
              {m.forecastPct != null ? ` · прогноз ${m.forecastPct}%` : ""}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Managers({ view, meName, onOpen }) {
  if (!view.managers.length) return <Card><p className="text-sm text-gray-500">Оплат пока нет.</p></Card>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {view.managers.map((m, i) => (
        <Card key={m.name} className="!p-0">
          <button onClick={() => onOpen(m.name)} className="w-full text-left p-4 active:opacity-70">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-gray-500 tabular-nums w-4">{i + 1}</span>
                <span className="font-semibold truncate">{m.name}</span>
                {isMe(m.name, meName) && <MeChip />}
              </span>
              <span className={`font-display font-semibold tabular-nums ${tone(m.pct, view.paceNeed)}`}>
                {m.pct == null ? "—" : `${m.pct}%`}
              </span>
            </div>
            <p className="font-display font-bold text-2xl tabular-nums mt-2">{mln(m.s)}</p>
            <p className="text-xs text-gray-500">{m.plan ? `план ${mln(m.plan)}` : "план не задан"}</p>
            <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5 mt-3 pt-3 border-t border-dark-700">
              <Stat label="Продаж" value={m.n} />
              <Stat label="С ПО / без" value={`${m.po} / ${m.nopo}`} />
              <Stat label="Ср. чек" value={m.n ? mln(m.s / m.n) : "—"} />
              <Stat label="Чистыми" value={mln(m.net)} />
              <Stat label="Интенсивы" value={m.ints} />
              <Stat label="Цикл, дн." value={m.cycle ?? "—"} />
            </dl>
          </button>
        </Card>
      ))}
      <p className="text-xs text-gray-500 sm:col-span-2">
        Продажи считаются без доплат. «С ПО» — клиент вносил предоплату, «без» — закрыт с нуля. Цикл — сколько дней в
        среднем от заявки до оплаты.
      </p>
    </div>
  );
}

function Bars({ items }) {
  const mx = Math.max(1, ...items.map((i) => i.s));
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.k} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="truncate">{it.k}</span>
            <span className="tabular-nums text-gray-400 shrink-0">
              {it.n} · {mln(it.s)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-dark-700 mt-1 overflow-hidden">
            <span className="block h-full bg-acid-400/70 rounded-full" style={{ width: `${(it.s / mx) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ManagerPage({ view, name, lead, meName, onBack }) {
  const m = view.managers.find((x) => x.name === name);
  const p = view.perManager[name];
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 active:opacity-60">
        <Icon name="chevronLeft" className="w-4 h-4" />
        Назад
      </button>
      <Card>
        <div className="flex items-center gap-2">
          <h2 className="font-display font-semibold text-lg">{name}</h2>
          {isMe(name, meName) && <MeChip />}
        </div>
        <p className="font-display font-bold text-[30px] leading-tight tabular-nums mt-2">{money(m.revenue)}</p>
        <p className="text-sm text-gray-400 mt-1">
          {m.payments} {plural(m.payments, "оплата", "оплаты", "оплат")} за {view.label.toLowerCase()}
          {m.plan ? (
            <>
              {" · "}
              <b className={tone(m.pct, view.paceNeed)}>{m.pct}%</b> плана {mln(m.plan)}
            </>
          ) : null}
        </p>
        <div className="mt-4">
          <CumChart cum={p.cum} dim={view.frac.dim} plan={m.plan} label={`Выручка ${name} по дням`} />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 pt-4 border-t border-dark-700">
          <Stat label="Продаж курса" value={m.n} sub={`с ПО ${m.po} · без ${m.nopo}`} />
          {m.forecastPct != null ? (
            <Stat label="Прогноз" value={`${m.forecastPct}% плана`} />
          ) : (
            <Stat label="Чистыми" value={mln(m.net)} />
          )}
          <Stat label="Интенсивы" value={m.ints} sub={m.intS ? mln(m.intS) : null} />
          <Stat label="Бонус" value={m.bonus ? money(m.bonus) : "—"} />
        </dl>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Формы оплаты</CardTitle>
          {p.forms.length ? <Bars items={p.forms} /> : <p className="text-sm text-gray-500">Нет данных.</p>}
        </Card>
        <Card>
          <CardTitle hint="по utm_source">Источники</CardTitle>
          {p.sources.length ? <Bars items={p.sources} /> : <p className="text-sm text-gray-500">Нет данных.</p>}
        </Card>
      </div>

      {lead && p.deals && (
        <Card>
          <CardTitle hint={`${p.deals.length}`}>Оплаты</CardTitle>
          <ul className="divide-y divide-dark-700 -my-1">
            {p.deals.map((d, i) => (
              <li key={i} className="py-2.5 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate">
                    {d.url ? (
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 decoration-dark-600">
                        {d.client}
                      </a>
                    ) : (
                      d.client
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {[d.day, d.tariff, d.form, d.po && "с ПО"].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="tabular-nums">{money(d.s)}</p>
                  {d.extra && <p className="text-xs text-amber-400">доплата</p>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
