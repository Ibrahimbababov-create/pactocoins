"use client";

import { useEffect, useState } from "react";
import { money, mln, plural } from "@/lib/sales/format";
import { Card, CardTitle, Stat, Empty, CountUp, STATUS } from "@/components/SalesUi";

// Пульт руководителя: все команды на одной странице. Цифры каждой команды
// посчитаны на сервере теми же функциями, что и экраны отдела.

const rgb = (c, a = 1) => `rgb(${c} / ${a})`;
const teamVars = (t) => (t.color ? { "--c-accent": t.color.accent, "--c-accent-strong": t.color.strong } : undefined);
const pc = (a, b) => (b ? Math.round((a / b) * 100) : null);
const fmtPct = (v) => (v == null ? "—" : `${v}%`);

function tone(pct, need) {
  if (pct == null) return undefined;
  if (pct >= need) return STATUS.good;
  if (pct >= need * 0.6) return STATUS.warn;
  return STATUS.bad;
}

// общий график: выручка с начала месяца по каждой команде её цветом
function TeamsChart({ teams, dim }) {
  const [hover, setHover] = useState(null);
  const W = 320;
  const H = 140;
  const max = Math.max(1, ...teams.map((t) => t.view.filters.all.cum.at(-1) || 0), ...teams.map((t) => t.view.plan || 0));
  const x = (i) => (dim > 1 ? (i / (dim - 1)) * W : 0);
  const y = (v) => H - (v / max) * (H - 10);
  const len = Math.max(0, ...teams.map((t) => t.view.filters.all.cum.length));
  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    setHover(Math.max(0, Math.min(len - 1, Math.round((cx / r.width) * (dim - 1)))));
  };
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto overflow-visible touch-pan-y"
        role="img"
        aria-label="Выручка команд с начала месяца"
        onMouseMove={pick}
        onTouchStart={pick}
        onTouchMove={pick}
        onMouseLeave={() => setHover(null)}
        onTouchEnd={() => setHover(null)}
      >
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1="0" x2={W} y1={y(max * g)} y2={y(max * g)} style={{ stroke: "rgb(var(--c-line))" }} strokeWidth="1" />
        ))}
        {teams.map((t) => {
          const cum = t.view.filters.all.cum;
          if (!cum.length) return null;
          const d = cum.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
          return (
            <g key={t.id}>
              <path className="sa-draw" pathLength="1" d={d} fill="none" strokeWidth="2.4" strokeLinejoin="round" style={{ stroke: rgb(t.color.accent) }} />
              <circle cx={x(cum.length - 1)} cy={y(cum.at(-1))} r="3.5" style={{ fill: rgb(t.color.accent), stroke: "rgb(var(--c-card))" }} strokeWidth="2" />
            </g>
          );
        })}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} style={{ stroke: "rgb(var(--c-muted))" }} strokeWidth="1" />}
      </svg>
      <div className="absolute left-0 top-0 text-[10px] text-gray-500 tabular-nums pointer-events-none">{mln(max)}</div>
      {hover != null && (
        <div className="mt-2 text-xs grid gap-1">
          <span className="text-gray-500">{hover + 1} число</span>
          {teams.map((t) => (
            <span key={t.id} className="flex justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: rgb(t.color.accent) }} />
                {t.name}
              </span>
              <b className="tabular-nums">{money(t.view.filters.all.cum[hover] ?? t.view.filters.all.cum.at(-1) ?? 0)}</b>
            </span>
          ))}
        </div>
      )}
      <div className="flex justify-between text-[11px] text-gray-500 mt-1">
        <span className="tabular-nums">1</span>
        <span className="tabular-nums">{dim}</span>
      </div>
    </div>
  );
}

// «Сегодня в amo» для одной команды — грузится отдельно
function AmoToday({ id }) {
  const [s, setS] = useState({ loading: true });
  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/sales/team?dept=${id}&period=today`).then((r) => r.json().then((j) => (r.ok ? j : Promise.reject(j)))),
      fetch(`/api/sales/team?dept=${id}&period=quota`).then((r) => r.json().then((j) => (r.ok ? j : null))),
    ])
      .then(([t, q]) => alive && setS({ t, q }))
      .catch((e) => alive && setS({ error: e?.error || "amoCRM не ответила" }));
    return () => {
      alive = false;
    };
  }, [id]);
  if (s.loading) return <p className="text-xs text-gray-500">Сегодня в amo: считаю…</p>;
  if (s.error) return <p className="text-xs text-gray-500">Сегодня в amo: {s.error}</p>;
  const inv = s.q ? s.q.managers.reduce((a, m) => a + m.inv, 0) : null;
  const need = s.q ? Math.ceil(s.q.q * s.q.managers.length) : null;
  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">Сегодня в amo</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <Stat label="Разговоров 1+ мин" value={s.t.kpi.talks} sub={`${s.t.kpi.min} мин на линии`} />
        <Stat label="Сообщений" value={s.t.kpi.msg} />
        <Stat label="Заявок за 15 мин" value={s.t.kpi.react15 != null ? `${s.t.kpi.react15}%` : "—"} sub={`новых: ${s.t.kpi.leadsNew}`} />
        <Stat label="Счета сегодня" value={inv != null ? `${inv} из ${need}` : "—"} />
      </dl>
      {s.t.kpi.mess > 0 && (
        <p className="text-xs mt-2" style={{ color: STATUS.warn }}>
          Без задач и просрочки: {s.t.kpi.mess}
        </p>
      )}
    </div>
  );
}

function TeamCard({ t, onOpen }) {
  const v = t.view;
  const all = v.filters.all;
  const top = v.managers.slice(0, 3);
  return (
    <section className="sa-rise bg-dark-800 border border-dark-700 rounded-2xl p-4 grid gap-4 content-start" style={teamVars(t)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-acid-400" />
          <span className="truncate">{t.name}</span>
        </h2>
        <button onClick={() => onOpen(t.id)} className="text-xs text-acid-400 shrink-0 active:opacity-60">
          Открыть →
        </button>
      </div>

      <div>
        <p className="font-display font-bold text-[28px] leading-none tabular-nums">
          <CountUp value={all.total} format={(x) => money(x).replace(" ₸", "")} />
          <span className="text-base text-gray-500 ml-1">₸</span>
        </p>
        <p className="text-xs text-gray-400 mt-1.5">
          {all.count} {plural(all.count, "оплата", "оплаты", "оплат")}
          {all.delta != null && (
            <>
              {" · "}
              <b style={{ color: all.delta >= 0 ? STATUS.good : STATUS.bad }}>
                {all.delta >= 0 ? "+" : ""}
                {all.delta}%
              </b>{" "}
              {v.frac.isCur ? "к той же дате прошлого месяца" : "к прошлому месяцу"}
            </>
          )}
        </p>
      </div>

      {v.plan > 0 ? (
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">План {mln(v.plan)}</span>
            <b style={{ color: tone(v.planPct, v.paceNeed) }}>{v.planPct}%</b>
          </div>
          <div className="relative h-2 rounded-full bg-dark-700 mt-1.5 overflow-hidden">
            <span className="sa-grow absolute inset-y-0 left-0 rounded-full bg-acid-400" style={{ width: `${Math.min(100, v.planPct)}%` }} />
            {v.frac.isCur && <span className="absolute inset-y-0 w-0.5 bg-gray-300/70" style={{ left: `${v.paceNeed}%` }} title="Темп: где нужно быть сегодня" />}
          </div>
          {all.forecast != null && (
            <p className="text-xs text-gray-500 mt-1.5">
              Прогноз на месяц: <b className="text-gray-300">{mln(all.forecast)}</b> ({fmtPct(pc(all.forecast, v.plan))} плана)
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-500">План на месяц в таблице не указан.</p>
      )}

      <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5 pt-3 border-t border-dark-700">
        <Stat label="Ср. чек" value={all.count ? mln(all.avg) : "—"} />
        <Stat label="Конверсия" value={v.conversion != null ? `${String(v.conversion).replace(".", ",")}%` : "—"} />
        <Stat label="ROAS" value={v.ads ? `1 : ${Math.round(v.ads.roas)}` : "—"} />
      </dl>

      {top.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {top.map((m, i) => (
            <li key={m.name} className="flex justify-between gap-3">
              <span className="truncate">
                <span className="text-gray-500 tabular-nums mr-2">{i + 1}</span>
                {m.name}
              </span>
              <span className="text-gray-400 shrink-0 tabular-nums">
                {mln(m.revenue)}
                {m.pct != null && <b className="ml-2" style={{ color: tone(m.pct, v.paceNeed) }}>{m.pct}%</b>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {t.amo && (
        <div className="pt-3 border-t border-dark-700">
          <AmoToday id={t.id} />
        </div>
      )}

      {v.insights.length > 0 && (
        <ul className="space-y-1.5 pt-3 border-t border-dark-700">
          {v.insights
            .filter(([k]) => k !== "ok")
            .slice(0, 2)
            .map(([kind, text], i) => (
              <li key={i} className="flex gap-2 text-xs text-gray-400">
                <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: kind === "bad" ? STATUS.bad : STATUS.warn }} />
                {text}
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

export default function OwnerOverview({ teams, broken = [], onOpen }) {
  const ok = teams.filter((t) => t.view);
  if (!ok.length)
    return (
      <Card>
        <Empty>Ни одна команда ещё не отдаёт цифры за этот месяц.</Empty>
      </Card>
    );
  const v0 = ok[0].view;
  const total = ok.reduce((a, t) => a + t.view.filters.all.total, 0);
  const course = ok.reduce((a, t) => a + t.view.course, 0);
  const plan = ok.reduce((a, t) => a + (t.view.plan || 0), 0);
  const count = ok.reduce((a, t) => a + t.view.filters.all.count, 0);
  const forecast = ok.reduce((a, t) => a + (t.view.filters.all.forecast ?? t.view.filters.all.total), 0);
  const prev = ok.reduce((a, t) => {
    const f = t.view.filters.all;
    return a + (f.delta != null ? f.total / (1 + f.delta / 100) : 0);
  }, 0);
  const delta = prev ? Math.round((total / prev - 1) * 100) : null;
  const spend = ok.reduce((a, t) => a + (t.view.ads?.spend || 0), 0);
  const cash = ok.reduce((a, t) => a + (t.view.ads ? t.view.ads.cash : 0), 0);
  const planPct = plan ? Math.round((course / plan) * 100) : null;

  const rows = [
    ["Выручка", (v) => mln(v.filters.all.total)],
    ["План", (v) => (v.plan ? mln(v.plan) : "—")],
    ["% плана", (v) => fmtPct(v.planPct), (v) => tone(v.planPct, v.paceNeed)],
    ["Прогноз", (v) => (v.filters.all.forecast != null ? mln(v.filters.all.forecast) : "—")],
    ["К прошлому месяцу", (v) => (v.filters.all.delta != null ? `${v.filters.all.delta >= 0 ? "+" : ""}${v.filters.all.delta}%` : "—")],
    ["Оплат", (v) => v.filters.all.count],
    ["Продаж курса", (v) => v.sales],
    ["Средний чек", (v) => (v.filters.all.count ? mln(v.filters.all.avg) : "—")],
    ["Конверсия лид → продажа", (v) => (v.conversion != null ? `${String(v.conversion).replace(".", ",")}%` : "—")],
    ["Реклама", (v) => (v.ads ? mln(v.ads.spend) : "—")],
    ["ROAS", (v) => (v.ads ? `1 : ${Math.round(v.ads.roas)}` : "—")],
    ["Предоплаты", (v) => (v.prepay ? `${v.prepay.total} · продал ${v.prepay.sold}` : "—")],
    ["Комиссии", (v) => mln(v.pay.total.lost)],
    ["Менеджеров", (v) => v.managers.length],
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <p className="text-sm text-gray-500">Выручка всех команд · {v0.label.toLowerCase()}</p>
          {v0.frac.isCur && <p className="text-xs text-gray-500">прошло {v0.paceNeed}% месяца</p>}
        </div>
        <p className="font-display font-bold text-[36px] leading-none tabular-nums mt-2">
          <CountUp value={total} format={(x) => money(x).replace(" ₸", "")} />
          <span className="text-lg text-gray-500 ml-1">₸</span>
        </p>
        <p className="text-sm text-gray-400 mt-2 flex flex-wrap gap-x-2">
          {delta != null && (
            <span>
              <b style={{ color: delta >= 0 ? STATUS.good : STATUS.bad }}>
                {delta >= 0 ? "+" : ""}
                {delta}%
              </b>{" "}
              к {v0.frac.isCur ? "тому же дню прошлого месяца" : "прошлому месяцу"}
            </span>
          )}
          {planPct != null && (
            <span>
              · <b style={{ color: tone(planPct, v0.paceNeed) }}>{planPct}%</b> общего плана {mln(plan)}
            </span>
          )}
        </p>
        <div className="mt-4">
          <TeamsChart teams={ok} dim={v0.frac.dim} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {ok.map((t) => (
            <span key={t.id} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full" style={{ background: rgb(t.color.accent) }} />
              {t.name}
            </span>
          ))}
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mt-4 pt-4 border-t border-dark-700">
          <Stat label="Оплат" value={count} />
          <Stat label={v0.frac.isCur ? "Прогноз на месяц" : "Итог месяца"} value={mln(forecast)} />
          <Stat label="Средний чек" value={count ? mln(total / count) : "—"} />
          <Stat label="ROAS всех команд" value={spend ? `1 : ${Math.round(cash / spend)}` : "—"} sub={spend ? `реклама ${mln(spend)}` : null} />
        </dl>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ok.map((t) => (
          <TeamCard key={t.id} t={t} onOpen={onOpen} />
        ))}
      </div>

      <Card>
        <CardTitle>Сравнение команд</CardTitle>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="text-sm w-full min-w-max">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="text-left font-normal py-1.5 pr-3" />
                {ok.map((t) => (
                  <th key={t.id} className="text-right font-normal py-1.5 px-2 whitespace-nowrap">
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: rgb(t.color.accent) }} />
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {rows.map(([label, get, color]) => (
                <tr key={label}>
                  <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">{label}</td>
                  {ok.map((t) => (
                    <td key={t.id} className="py-2 px-2 text-right tabular-nums whitespace-nowrap" style={{ color: color ? color(t.view) : undefined }}>
                      {get(t.view)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {broken.length > 0 && (
        <p className="text-xs text-gray-500">
          Без данных за этот месяц: {broken.join(", ")}.
        </p>
      )}
    </div>
  );
}
