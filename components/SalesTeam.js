"use client";

import { useEffect, useState } from "react";
import { mln, plural } from "@/lib/sales/format";
import { Card, CardTitle, Stat, Empty, Bars, Chips, Donut, STATUS, colorFor, seriesOf } from "@/components/SalesUi";

// «Работа команды» и «Квота на сегодня» — данные amoCRM. Грузятся отдельным
// запросом (/api/sales/team): amo отвечает медленно, страницу это не держит.

function useAmo(deptId, period, extra = "") {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    fetch(`/api/sales/team?dept=${encodeURIComponent(deptId)}&period=${period}${extra}`)
      .then(async (r) => {
        let j = null;
        try {
          j = await r.json();
        } catch {}
        if (!alive) return;
        if (!j) return setState({ error: "Загрузка заняла слишком много времени, выбери период покороче" });
        setState(r.ok ? { data: j } : { error: j.error || "amoCRM не ответила" });
      })
      .catch(() => alive && setState({ error: "Нет связи с сервером" }));
    return () => {
      alive = false;
    };
  }, [deptId, period, extra]);
  return state;
}

const minFmt = (v) => (v == null ? "—" : v < 60 ? `${Math.round(v)} мин` : `${String(Math.round(v / 6) / 10).replace(".", ",")} ч`);
const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0);

function AmoLink({ domain, id, children }) {
  return (
    <a
      href={`https://${domain}/leads/detail/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 decoration-dark-600"
    >
      {children}
    </a>
  );
}

function Loading({ text = "Считаю по amoCRM… это до минуты" }) {
  return (
    <Card>
      <div className="flex items-center gap-3 text-sm text-gray-400 py-4">
        <span className="w-4 h-4 rounded-full border-2 border-dark-600 border-t-acid-400 animate-spin" />
        {text}
      </div>
    </Card>
  );
}

/* ---------- Квота на сегодня (Сводка) ---------- */
export function QuotaToday({ deptId }) {
  const { loading, data, error } = useAmo(deptId, "quota");
  return (
    <Card>
      <CardTitle hint={data ? `${String(data.q).replace(".", ",")} на менеджера · счета из amo` : null}>Квота на сегодня</CardTitle>
      {loading ? (
        <p className="text-sm text-gray-500">Считаю счета за сегодня в amo…</p>
      ) : error ? (
        <Empty>{error}</Empty>
      ) : !data.managers.length ? (
        <Empty>Нет менеджеров с планом.</Empty>
      ) : (
        <ul className="space-y-3">
          {data.managers.map((m) => {
            const done = m.inv >= data.q;
            return (
              <li key={m.name} className="text-sm">
                <div className="flex justify-between gap-3">
                  <span className="truncate">{m.name}</span>
                  <span className="shrink-0 tabular-nums" style={{ color: done ? STATUS.good : undefined }}>
                    {m.inv} из {String(data.q).replace(".", ",")}
                    {done ? " · предоплаты открыты" : ""}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-dark-700 mt-1 overflow-hidden" role="progressbar" aria-valuenow={m.inv} aria-valuemax={data.q} aria-label={m.name}>
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.min(100, (m.inv / data.q) * 100)}%`, background: done ? STATUS.good : "rgb(var(--c-accent))" }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {data?.best != null && (
        <p className="text-xs text-gray-500 mt-3">
          Квота = лучший результат без ПО в прошлом месяце ({data.best}) ÷ 40% ÷ 22 дня. Счёт — переход сделки на этап со словом «счёт».
        </p>
      )}
    </Card>
  );
}

/* ---------- Работа команды ---------- */
const METRICS = [
  ["talks", "Разговоры 1+ мин", (m) => `${m.talks} · ${m.min} мин`],
  ["min", "Минуты", (m) => `${m.min} мин`],
  ["calls", "Звонки", (m) => `${m.calls}`],
  ["msg", "Сообщения", (m) => `${m.msg}`],
  ["st", "Этапы", (m) => `${m.st}`],
  ["leads", "Сделок", (m) => `${m.leads}`],
];

function Heat({ managers }) {
  const H = Array.from({ length: 15 }, (_, i) => i + 8);
  const mx = Math.max(1, ...managers.flatMap((m) => H.map((h) => m.hours[h])));
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="text-xs min-w-max border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th />
            {H.map((h) => (
              <th key={h} className="font-normal text-gray-500 w-7 text-center">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {managers.map((m) => (
            <tr key={m.name}>
              <td className="pr-2 whitespace-nowrap text-gray-300">{m.name}</td>
              {H.map((h) => {
                const v = m.hours[h];
                return (
                  <td
                    key={h}
                    title={`${m.name}, ${h}:00 — ${v}`}
                    className="w-7 h-6 rounded text-center tabular-nums text-[10px]"
                    style={{
                      background: v ? `rgb(var(--c-accent) / ${(0.15 + 0.85 * (v / mx)).toFixed(2)})` : "rgb(var(--c-line) / 0.5)",
                      color: v / mx > 0.55 ? "rgb(var(--c-bg))" : "rgb(var(--c-muted))",
                    }}
                  >
                    {v || ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeadList({ title, items, domain, render }) {
  if (!items?.length) return null;
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-gray-300">
        {title}: {items.length}
      </summary>
      <ul className="mt-2 divide-y divide-dark-700">
        {items.map((x, i) => (
          <li key={i} className="py-2 flex justify-between gap-3">
            <span className="min-w-0 truncate">
              <AmoLink domain={domain} id={x.id}>
                {x.name || x.text}
              </AmoLink>
              <span className="text-gray-500"> · {x.m}</span>
            </span>
            <span className="text-xs text-gray-500 shrink-0">{render(x)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function TeamScreen({ deptId, monthKey, people }) {
  const [period, setPeriod] = useState("today");
  const [metric, setMetric] = useState("talks");
  const { loading, data: T, error } = useAmo(deptId, period);
  const loss = useAmo(deptId, "loss", `&month=${monthKey}`);
  const all = [...new Set([...people, ...(T?.managers || []).map((m) => m.name)])];
  const met = METRICS.find((x) => x[0] === metric);

  return (
    <div className="space-y-4">
      <Chips
        label="Период"
        options={[
          ["today", "Сегодня"],
          ["yesterday", "Вчера"],
          ["week", "7 дней"],
        ]}
        value={period}
        onChange={setPeriod}
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <Card>
          <Empty>{error}</Empty>
        </Card>
      ) : (
        <>
          <Card>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Stat label="Разговоров 1+ мин" value={T.kpi.talks} sub={`${T.kpi.min} мин на линии`} />
              <Stat label="Сообщений клиентам" value={T.kpi.msg} />
              <Stat label="Заявок обработано за 15 мин" value={T.kpi.react15 != null ? `${T.kpi.react15}%` : "—"} sub={`новых заявок: ${T.kpi.leadsNew}`} />
              <Stat label="Без задач и просрочки" value={T.kpi.mess} />
            </dl>
            {T.partial && <p className="text-xs text-amber-400 mt-3">Данные могут быть неполными: часть событий не попала в расчёт.</p>}
          </Card>

          <Card>
            <CardTitle>Активность менеджеров</CardTitle>
            <Chips label="Показатель" options={METRICS.map(([k, l]) => [k, l])} value={metric} onChange={setMetric} />
            <div className="mt-3">
              {T.managers.length ? (
                <Bars
                  items={[...T.managers]
                    .sort((a, b) => b[metric] - a[metric])
                    .map((m) => ({ k: m.name, s: m[metric], m, color: colorFor(m.name, all) }))}
                  value={(it) => met[2](it.m)}
                />
              ) : (
                <Empty>Пока нет действий в amo за этот период.</Empty>
              )}
            </div>
            {T.managers.length > 0 && (
              <div className="overflow-x-auto -mx-4 px-4 mt-4">
                <table className="text-sm w-full min-w-max">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      {["Менеджер", "Сделок", "Звонков", "Дозвонов", "Разговоров", "Минут", "Сообщ.", "Этапов", "Задач"].map((h, i) => (
                        <th key={h} className={`font-normal py-1.5 ${i ? "text-right px-2" : "text-left pr-3"}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {T.managers.map((m) => (
                      <tr key={m.name}>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: colorFor(m.name, all) }} />
                          {m.name}
                        </td>
                        {[m.leads, m.calls, m.dials, m.talks, m.min, m.msg, m.st, m.done].map((v, i) => (
                          <td key={i} className={`py-2 px-2 text-right tabular-nums ${i === 3 ? "font-semibold" : ""}`}>
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-3">
              Разговор — звонок от 1 минуты, дозвон — звонок с любой длительностью. Массовые переносы сделок по этапам работой не считаются.
            </p>
          </Card>

          {T.managers.length > 0 && (
            <Card>
              <CardTitle hint="звонки, сообщения и этапы по часам">Когда работали</CardTitle>
              <Heat managers={T.managers} />
            </Card>
          )}

          <Card>
            <CardTitle hint="от заявки до первого касания">Скорость реакции</CardTitle>
            {T.reaction.length ? (
              <ul className="divide-y divide-dark-700 -my-1">
                {T.reaction.map((r) => (
                  <li key={r.name} className="py-2.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <span>{r.name}</span>
                      <b
                        className="tabular-nums"
                        style={{ color: r.median == null ? undefined : r.median <= 15 ? STATUS.good : r.median <= 60 ? STATUS.warn : STATUS.bad }}
                      >
                        {minFmt(r.median)}
                      </b>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.n} {plural(r.n, "заявка", "заявки", "заявок")} · до 15 мин {pc(r.in15, r.n)}% · до часа {pc(r.in60, r.n)}%
                      {r.miss ? <span style={{ color: STATUS.bad }}> · без касания {r.miss}</span> : null}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Новых заявок в воронке за этот период не было.</Empty>
            )}
            <LeadList title="Заявки без касания" items={T.missList} domain={T.domain} render={(x) => `ждёт ${minFmt(x.wait)}`} />
            <p className="text-xs text-gray-500 mt-3">Заявка ночью считается пришедшей в 9:00 по Алматы.</p>
          </Card>

          <Card>
            <CardTitle hint={`«${T.pipeline}» · в работе ${T.openCount}`}>Воронка сейчас</CardTitle>
            <Bars
              items={T.funnel
                .filter((s) => s.count)
                .map((s) => ({ k: s.name, s: s.count, sum: s.sum, stale: Object.values(s.stale).reduce((a, b) => a + b, 0) }))}
              measure={(it) => it.s}
              value={(it) => `${it.s}${it.sum ? ` · ${mln(it.sum)}` : ""}${it.stale ? ` · застр. ${it.stale}` : ""}`}
            />
          </Card>

          <Card>
            <CardTitle hint="сделки за 30 дней">Конверсия по этапам</CardTitle>
            {T.conv.total ? (
              <>
                <Bars
                  items={[
                    ...T.conv.stages.map((s) => ({ k: s.name, s: s.pct, n: s.n })),
                    { k: "Оплатили", s: pc(T.conv.won, T.conv.total), n: T.conv.won, color: STATUS.good },
                  ]}
                  value={(it) => `${it.s}% · ${it.n}`}
                />
                <p className="text-xs text-gray-500 mt-3">
                  Всего {T.conv.total} сделок, закрыто без оплаты {T.conv.lost}. «Дошли до этапа» — сейчас на этом этапе или дальше.
                </p>
              </>
            ) : (
              <Empty>Нет сделок за 30 дней.</Empty>
            )}
          </Card>

          {T.funnel.some((s) => s.count) && (
            <Card>
              <CardTitle hint="в скобках — без движения 3+ дня">Где застревают сделки</CardTitle>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="text-sm w-full min-w-max">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="text-left font-normal py-1.5 pr-3">Этап</th>
                      {[...new Set(T.funnel.flatMap((s) => Object.keys(s.by)))].map((m) => (
                        <th key={m} className="text-right font-normal py-1.5 px-2">
                          {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {T.funnel
                      .filter((s) => s.count)
                      .map((s) => (
                        <tr key={s.name}>
                          <td className="py-2 pr-3 whitespace-nowrap">{s.name}</td>
                          {[...new Set(T.funnel.flatMap((x) => Object.keys(x.by)))].map((m) => (
                            <td key={m} className="py-2 px-2 text-right tabular-nums">
                              {s.by[m] || <span className="text-gray-600">·</span>}
                              {s.stale[m] ? <span style={{ color: STATUS.bad }}> ({s.stale[m]})</span> : null}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card>
            <CardTitle>Порядок в amo</CardTitle>
            <dl className="grid grid-cols-3 gap-3">
              <Stat label="Без задач" value={T.order.noTaskN} />
              <Stat label="Застряли 3+ дня" value={T.order.staleN} />
              <Stat label="Просрочки" value={T.order.overdueN} />
            </dl>
            {T.order.noTaskBy.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">Сделки без задач по менеджерам</p>
                <Bars
                  items={T.order.noTaskBy.map((x) => ({ k: x.k, s: x.v, color: colorFor(x.k, all) }))}
                  measure={(it) => it.s}
                  value={(it) => `${it.s}`}
                />
              </div>
            )}
            <LeadList title="Без задач" items={T.order.noTask} domain={T.domain} render={(x) => `${x.stage} · ${x.days} дн.`} />
            <LeadList title="Просроченные задачи" items={T.order.overdue} domain={T.domain} render={(x) => `просрочка ${x.days} дн.`} />
            <LeadList title="Застряли 3+ дня" items={T.order.stale} domain={T.domain} render={(x) => `${x.stage} · ${x.days} дн.`} />
          </Card>
        </>
      )}

      <Card>
        <CardTitle hint="закрыто без оплаты за месяц">Причины отказов</CardTitle>
        {loss.loading ? (
          <p className="text-sm text-gray-500">Загружаю отказы из amo…</p>
        ) : loss.error ? (
          <Empty>{loss.error}</Empty>
        ) : loss.data.total ? (
          <>
            <Donut
              items={loss.data.reasons.map((r, i) => ({
                label: r.k,
                v: r.v,
                color: /не указан/i.test(r.k) ? "rgb(var(--c-dim))" : seriesOf(i),
              }))}
              center={[loss.data.total, "отказов"]}
              fmt={(v) => `${v} шт`}
              label="Причины отказов"
            />
            {loss.data.byManager.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm">
                {loss.data.byManager.map((m) => (
                  <li key={m.m} className="flex justify-between gap-3">
                    <span className="truncate">{m.m}</span>
                    <span className="text-gray-400 shrink-0">
                      {m.n} · чаще: {m.top}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <Empty>Отказов за месяц нет.</Empty>
        )}
      </Card>
    </div>
  );
}
