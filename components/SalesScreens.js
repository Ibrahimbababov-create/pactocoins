"use client";

import { useState } from "react";
import { money, mln, plural } from "@/lib/sales/format";
import { Card, CardTitle, Stat, Empty, Bars, Legend, Chips, colorFor, Donut, StackBar, STATUS, sourceColor, CumChart } from "@/components/SalesUi";

// Экраны «Оплаты», «Источники», «Интенсивы», «Динамика», «Квота», «Сделки».
// Цифры посчитаны на сервере (lib/sales/metrics.js → extraScreens).

const pct1 = (v) => `${String(Math.round(v * 1000) / 10).replace(".", ",")}%`;
// цвета для списков без закреплённых людей (формы оплаты): по порядку, девятый и дальше серые
const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const seriesColor = (i) => (i < SERIES.length ? SERIES[i] : "rgb(var(--c-dim))");
const poColor = (l) =>
  /продал/i.test(l) ? STATUS.good : /возврат|отказ|неодоб/i.test(l) ? STATUS.bad : /некст/i.test(l) ? STATUS.warn : STATUS.info;
const share = (a, b) => (b ? Math.round((a / b) * 100) : 0);

function commissionTone(k) {
  if (k >= 0.25) return "text-red-400";
  if (k >= 0.1) return "text-amber-400";
  return "text-gray-400";
}

/* ---------- Оплаты ---------- */
export function PayScreen({ view }) {
  const { forms, total } = view.pay;
  if (!total.cnt) return <Card><Empty /></Card>;
  const lostShare = total.s ? total.lost / total.s : 0;
  const tariffItems = view.tariffs.map((t, i) => ({ label: t.label, v: t.n, color: i ? "#c98500" : "#3987e5" }));
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Формы оплаты</CardTitle>
          <Donut
            items={forms.map((p, i) => ({ label: p.k, v: p.cnt, color: seriesColor(i) }))}
            center={[total.cnt, "оплат"]}
            fmt={(v) => `${v} шт`}
            label="Оплаты по формам оплаты"
          />
        </Card>
        <Card>
          <CardTitle>Куда ушли деньги</CardTitle>
          <Donut
            items={[
              { label: "Чистыми отделу", v: total.net, color: STATUS.good },
              { label: "Комиссии банков и рассрочек", v: total.lost, color: STATUS.bad },
            ]}
            center={[`${Math.round(lostShare * 100)}%`, "на комиссии"]}
            fmt={mln}
            label="Чистыми и комиссии"
          />
        </Card>
        <Card>
          <CardTitle hint="сколько съела комиссия">Потери на комиссии</CardTitle>
          <Bars
            items={[...forms]
              .filter((p) => p.lost > 0)
              .sort((a, b) => b.lost - a.lost)
              .map((p) => ({
                k: p.k,
                s: p.lost,
                rate: p.rate,
                color: p.rate >= 0.25 ? STATUS.bad : p.rate >= 0.1 ? STATUS.warn : STATUS.good,
              }))}
            value={(it) => `${mln(it.s)} · ${pct1(it.rate)}`}
          />
        </Card>
        <Card>
          <CardTitle>Тарифы</CardTitle>
          <Donut items={tariffItems} center={[view.sales, "продаж"]} fmt={(v) => `${v} шт`} label="Продажи по тарифам" />
        </Card>
      </div>

      <Card>
        <CardTitle hint={`${total.cnt} ${plural(total.cnt, "оплата", "оплаты", "оплат")}`}>Все формы оплаты</CardTitle>
        <ul className="divide-y divide-dark-700 -my-1">
          {forms.map((p, i) => (
            <li key={p.k} className="py-3">
              <div className="flex justify-between gap-3">
                <span className="font-medium min-w-0 truncate flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seriesColor(i) }} />
                  {p.k}
                </span>
                <span className="tabular-nums shrink-0">{mln(p.s)}</span>
              </div>
              <div className="flex justify-between gap-3 text-xs mt-1">
                <span className="text-gray-500">
                  {p.cnt} {plural(p.cnt, "оплата", "оплаты", "оплат")} · чистыми {mln(p.net)}
                </span>
                <span className={commissionTone(p.rate)}>
                  комиссия {pct1(p.rate)}
                  {p.lost > 0 ? ` · −${mln(p.lost)}` : ""}
                </span>
              </div>
            </li>
          ))}
          <li className="py-3 flex justify-between gap-3 font-semibold">
            <span>Итого</span>
            <span className="tabular-nums">
              {mln(total.s)} · чистыми {mln(total.net)}
            </span>
          </li>
        </ul>
        <p className="text-xs text-gray-500 mt-3">Красным — комиссия 25% и выше, жёлтым — от 10%.</p>
      </Card>
    </div>
  );
}

/* ---------- Источники ---------- */
export function SourcesScreen({ view }) {
  const { rows, roas, creatives, matrix } = view.sources;
  if (!rows.length) return <Card><Empty /></Card>;
  const total = rows.reduce((a, r) => a + r.s, 0);
  const cnt = rows.reduce((a, r) => a + r.n, 0);
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardTitle hint="число продаж">По источникам</CardTitle>
          <Donut
            items={rows.map((r, i) => ({ label: r.name, v: r.n, color: sourceColor(r.name, i) }))}
            center={[cnt, "продаж"]}
            fmt={(v) => `${v} шт`}
            label="Продажи по источникам"
          />
        </Card>
        <Card>
          <CardTitle hint="выручка">По источникам</CardTitle>
          <Donut
            items={rows.map((r, i) => ({ label: r.name, v: r.s, color: sourceColor(r.name, i) }))}
            center={[mln(total).replace(" ₸", ""), "выручка"]}
            fmt={mln}
            label="Выручка по источникам"
          />
        </Card>
      </div>
      <Card>
        <CardTitle hint="utm_source">Продажи по источникам</CardTitle>
        <ul className="divide-y divide-dark-700 -my-1">
          {rows.map((r) => (
            <li key={r.k} className="py-3">
              <div className="flex justify-between gap-3">
                <span className="font-medium min-w-0 truncate">{r.name}</span>
                <span className="tabular-nums shrink-0">{mln(r.s)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-dark-700 mt-1.5 overflow-hidden">
                <span className="block h-full rounded-full bg-acid-400/70" style={{ width: `${share(r.s, total)}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                {r.n} {plural(r.n, "продажа", "продажи", "продаж")} · {share(r.s, total)}% выручки
                {r.n ? ` · ср. чек ${mln(r.s / r.n)}` : ""} · с ПО {r.po}
                {r.poAll ? ` · ПО внесли ${r.poAll}, купили ${share(r.poSold, r.poAll)}%` : ""}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500 mt-3">
          «ПО внесли» — предоплаты по этому источнику, «купили» — какая доля из них уже купила курс.
        </p>
      </Card>

      {roas && (
        <Card>
          <CardTitle>Таргет PinkBubble</CardTitle>
          <dl className="grid grid-cols-3 gap-3">
            <Stat label="Расход" value={mln(roas.spend)} />
            <Stat label="Продажи" value={mln(roas.s)} sub={`${roas.n} шт`} />
            <Stat label="ROAS" value={roas.spend ? `1 : ${String((roas.s / roas.spend).toFixed(1)).replace(".", ",")}` : "—"} />
          </dl>
        </Card>
      )}

      <Card>
        <CardTitle hint="utm_content">Креативы</CardTitle>
        {creatives.length ? <Bars items={creatives} /> : <Empty>В продажах нет utm_content.</Empty>}
      </Card>

      {matrix.rows.length > 0 && matrix.people.length > 0 && (
        <Card>
          <CardTitle hint="число продаж">Источник × менеджер</CardTitle>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="text-sm w-full min-w-max">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="text-left font-normal py-1.5 pr-3">Источник</th>
                  {matrix.people.map((p) => (
                    <th key={p} className="text-right font-normal py-1.5 px-2">{p}</th>
                  ))}
                  <th className="text-right font-normal py-1.5 pl-2">Всего</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {matrix.rows.map((r) => (
                  <tr key={r.name}>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.name}</td>
                    {r.by.map((v, i) => (
                      <td key={i} className={`py-2 px-2 text-right tabular-nums ${v ? "" : "text-gray-600"}`}>{v || "·"}</td>
                    ))}
                    <td className="py-2 pl-2 text-right tabular-nums font-semibold">{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------- Интенсивы ---------- */
function StackedColumns({ days, people, label }) {
  const W = 320;
  const H = 120;
  const n = Math.max(days.length, 1);
  const slot = W / n;
  const bw = Math.min(28, slot - 4);
  const mx = Math.max(1, ...days.map((d) => d.total));
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full h-auto" role="img" aria-label={label}>
      {days.map((d, i) => {
        let y = H;
        const x = i * slot + (slot - bw) / 2;
        return (
          <g key={d.d}>
            {people
              .filter((p) => d.by[p])
              .map((p) => {
                const h = (d.by[p] / mx) * (H - 14);
                y -= h;
                return (
                  <rect key={p} x={x} y={y} width={bw} height={Math.max(h - 1, 1)} rx="2" style={{ fill: colorFor(p, people) }}>
                    <title>{`${d.label} — ${p}: ${d.by[p]}`}</title>
                  </rect>
                );
              })}
            <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize="10" style={{ fill: "rgb(var(--c-text))" }}>
              {d.total}
            </text>
            {(n <= 10 || i % Math.ceil(n / 8) === 0) && (
              <text x={x + bw / 2} y={H + 13} textAnchor="middle" fontSize="9" style={{ fill: "rgb(var(--c-muted))" }}>
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function IntensivesScreen({ view }) {
  const I = view.intensives;
  if (!I.count && !I.bz) return <Card><Empty>Интенсивов в этом месяце не было.</Empty></Card>;
  const people = view.people;
  return (
    <div className="space-y-4">
      <Card>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat label="Продано интенсивов" value={I.count} />
          <Stat label="Выручка" value={mln(I.sum)} />
          <Stat label="ПО на курс с бизнес-завтрака" value={I.bz} />
          <Stat label="Перешли в курс" value={I.converted} sub={I.count ? `${share(I.converted, I.count)}% купивших интенсив` : null} />
        </dl>
      </Card>

      {I.daily.length > 0 && (
        <Card>
          <CardTitle hint="штук в день">Продажи интенсива по дням</CardTitle>
          <StackedColumns days={I.daily} people={people} label="Продажи интенсива по дням и менеджерам" />
          <Legend all={people} shown={people.filter((p) => I.daily.some((d) => d.by[p]))} />
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardTitle>По менеджерам</CardTitle>
          <Donut
            items={I.byManager.map((x) => ({ label: x.k, v: x.v, color: colorFor(x.k, people) }))}
            center={[I.count, "интенсивов"]}
            fmt={(v) => `${v} шт`}
            label="Интенсивы по менеджерам"
          />
        </Card>
        <Card>
          <CardTitle>По источникам</CardTitle>
          <Donut
            items={I.bySource.map((x, i) => ({ label: x.k, v: x.v, color: sourceColor(x.k, i) }))}
            center={[I.count, "продаж"]}
            fmt={(v) => `${v} шт`}
            label="Интенсивы по источникам"
          />
        </Card>
      </div>

      {I.bzStatus.length > 0 && (
        <Card>
          <CardTitle>Предоплаты с бизнес-завтрака</CardTitle>
          <Donut
            items={I.bzStatus.map((x) => ({ label: x.k, v: x.v, color: poColor(x.k) }))}
            center={[I.bz, "предоплат"]}
            fmt={(v) => `${v} шт`}
            label="Предоплаты с бизнес-завтрака по статусам"
          />
        </Card>
      )}

      {I.convertedList && (
        <Card>
          <CardTitle hint={`${I.convertedList.length}`}>Купили интенсив → купили курс</CardTitle>
          {I.convertedList.length ? (
            <ul className="divide-y divide-dark-700 -my-1">
              {I.convertedList.map((d, i) => (
                <li key={i} className="py-2.5 flex justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{d.client}</span>
                    <span className="text-xs text-gray-500">{d.m} · {d.day}</span>
                  </span>
                  <span className="tabular-nums shrink-0">{money(d.s)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Пока никто из купивших интенсив не купил курс.</Empty>
          )}
        </Card>
      )}
    </div>
  );
}

/* ---------- Динамика ---------- */
function DailyBars({ days, lastDay, people }) {
  const W = 320;
  const H = 120;
  const slot = W / days.length;
  const bw = Math.max(slot - 2, 1);
  const mx = Math.max(1, ...days.map((d) => d.total));
  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full h-auto" role="img" aria-label="Выручка по дням и менеджерам">
      {days.map((d, i) => {
        const x = i * slot + 1;
        let y = H;
        return (
          <g key={d.day} opacity={d.day > lastDay ? 0.35 : 1}>
            {d.weekend && <rect x={i * slot} y="0" width={slot} height={H} style={{ fill: "rgb(var(--c-line) / 0.5)" }} />}
            {people
              .filter((p) => d.by[p])
              .map((p) => {
                const h = (d.by[p] / mx) * (H - 4);
                y -= h;
                return (
                  <rect key={p} x={x} y={y} width={bw} height={Math.max(h - 1, 1)} rx="1.5" style={{ fill: colorFor(p, people) }}>
                    <title>{`${d.day} число — ${p}: ${money(d.by[p])}`}</title>
                  </rect>
                );
              })}
            {(d.day === 1 || d.day % 5 === 0) && (
              <text x={x + bw / 2} y={H + 12} textAnchor="middle" fontSize="9" style={{ fill: "rgb(var(--c-muted))" }}>
                {d.day}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function DynamicsScreen({ view }) {
  const D = view.dynamics;
  const people = view.people;
  const sellers = view.sources.matrix.people;
  const hasSales = D.daily.some((d) => d.total);
  if (!hasSales) return <Card><Empty>Продаж курса в этом месяце нет.</Empty></Card>;
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle hint={view.plan ? `план ${mln(view.plan)}` : null}>Накопительно к плану</CardTitle>
        <CumChart monthGen={view.monthGen} cum={view.filters.course.cum} dim={view.frac.dim} plan={view.plan} label="Выручка курса с начала месяца" />
      </Card>

      <Card>
        <CardTitle hint="серым — выходные">Выручка по дням</CardTitle>
        <DailyBars days={D.daily} lastDay={D.lastDay} people={people} />
        <Legend all={people} shown={people.filter((p) => D.daily.some((d) => d.by[p]))} />
      </Card>

      {D.weeks.length > 0 && (
        <Card>
          <CardTitle hint="число продаж">По неделям</CardTitle>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="text-sm w-full min-w-max">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="text-left font-normal py-1.5 pr-3">Неделя</th>
                  <th className="text-right font-normal py-1.5 px-2">Продаж</th>
                  <th className="text-right font-normal py-1.5 px-2">Сумма</th>
                  {sellers.map((p) => (
                    <th key={p} className="text-right font-normal py-1.5 px-2">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {D.weeks.map((w) => (
                  <tr key={w.label}>
                    <td className="py-2 pr-3 whitespace-nowrap">{w.label}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{w.n}</td>
                    <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">{mln(w.s)}</td>
                    {w.by.map((v, i) => (
                      <td key={i} className={`py-2 px-2 text-right tabular-nums ${v ? "" : "text-gray-600"}`}>{v || "·"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle hint="от заявки до оплаты">Цикл сделки</CardTitle>
        <Bars items={D.cycle.map((c) => ({ k: c.label, n: c.v }))} measure={(it) => it.n} value={(it) => `${it.n}`} />
      </Card>
    </div>
  );
}

/* ---------- Квота ---------- */
function NumberField({ id, label, value, onChange, suffix, min = 0, max }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="mt-1 flex items-center gap-2 bg-dark-900/60 border border-dark-700 rounded-xl px-3 py-2 focus-within:border-acid-400">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent outline-none font-display font-semibold tabular-nums"
        />
        {suffix && <span className="text-sm text-gray-500 shrink-0">{suffix}</span>}
      </span>
    </label>
  );
}

export function QuotaScreen({ view }) {
  const Q = view.quota;
  const [target, setTarget] = useState(String(Q.best));
  const [cr, setCr] = useState("40");
  const [days, setDays] = useState("22");
  const [mgrs, setMgrs] = useState(String(Q.managers));
  const T = Math.max(0, +target || 0);
  const C = Math.max(1, +cr || 1) / 100;
  const D = Math.max(1, +days || 1);
  const N = Math.max(1, +mgrs || 1);
  const perDay = T / C / D;
  const fmt = (v) => String(Math.round(v * 10) / 10).replace(".", ",");
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Сколько счетов выставлять</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          <NumberField id="q-target" label="Цель: продаж без ПО на менеджера" value={target} onChange={setTarget} suffix="шт" />
          <NumberField id="q-cr" label="Конверсия счёт → оплата" value={cr} onChange={setCr} suffix="%" min={1} max={100} />
          <NumberField id="q-days" label="Рабочих дней в месяце" value={days} onChange={setDays} suffix="дн" min={1} />
          <NumberField id="q-mgrs" label="Менеджеров" value={mgrs} onChange={setMgrs} suffix="чел" min={1} />
        </div>
        <div className="mt-4 pt-4 border-t border-dark-700">
          <p className="font-display font-bold text-[32px] leading-none tabular-nums">
            {fmt(perDay)}
            <span className="text-base text-gray-400 font-sans font-semibold ml-2">
              {plural(Math.round(perDay), "счёт", "счёта", "счетов")} в день
            </span>
          </p>
          <p className="text-sm text-gray-400 mt-2">
            ≈ {Math.ceil(perDay * 5)} в неделю на менеджера · {Math.ceil(perDay * N)} в день на отдел ·{" "}
            {Math.round(T * N)} продаж без ПО в месяц
          </p>
        </div>
      </Card>
      <Card>
        <CardTitle>Без ПО в этом месяце закрыли</CardTitle>
        {Q.noPo.length ? (
          <Bars items={Q.noPo.map((x) => ({ k: x.name, n: x.v }))} measure={(it) => it.n} value={(it) => `${it.n}`} />
        ) : (
          <Empty>Пока никто.</Empty>
        )}
        <p className="text-xs text-gray-500 mt-3">
          По умолчанию цель равна результату лучшего менеджера. Конверсию счёт → оплата возьмите из amoCRM по этапу
          «Выставлен счёт».
        </p>
      </Card>
    </div>
  );
}

/* ---------- Сделки ---------- */
export function DealsScreen({ view }) {
  const [fm, setFm] = useState("all");
  const [fs, setFs] = useState("all");
  const [fp, setFp] = useState("all");
  const deals = view.deals || [];
  const mgrOpts = [["all", "Все"], ...[...new Set(deals.map((d) => d.m))].map((m) => [m, m])];
  const srcOpts = [["all", "Все источники"], ...[...new Set(deals.map((d) => d.src))].map((s) => [s, s])];
  const list = deals.filter(
    (d) =>
      (fm === "all" || d.m === fm) &&
      (fs === "all" || d.src === fs) &&
      (fp === "all" || (fp === "po") === d.po)
  );
  const total = list.reduce((a, d) => a + d.s, 0);
  const net = list.reduce((a, d) => a + d.net, 0);
  return (
    <div className="space-y-3">
      <Chips label="Менеджер" options={mgrOpts} value={fm} onChange={setFm} />
      <Chips label="Источник" options={srcOpts} value={fs} onChange={setFs} />
      <Chips
        label="Предоплата"
        options={[["all", "С ПО и без"], ["po", "С ПО"], ["nopo", "Без ПО"]]}
        value={fp}
        onChange={setFp}
      />
      <Card>
        <CardTitle hint={`чистыми ${mln(net)}`}>
          {list.length} {plural(list.length, "сделка", "сделки", "сделок")} · {mln(total)}
        </CardTitle>
        {list.length ? (
          <ul className="divide-y divide-dark-700 -my-1">
            {list.map((d, i) => (
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
                    <span className="text-gray-500"> · {d.m}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {[d.day, d.form, d.src, d.cnt, d.po && "с ПО", d.age != null && `цикл ${d.age} дн`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="tabular-nums">{money(d.s)}</p>
                  {d.extra ? (
                    <p className="text-xs text-amber-400">доплата</p>
                  ) : (
                    <p className="text-xs text-gray-500 tabular-nums">{mln(d.net)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Под эти фильтры сделок нет.</Empty>
        )}
      </Card>
    </div>
  );
}

/* ---------- Сводка: реклама и предоплаты ---------- */
export function AdsCard({ ads }) {
  return (
    <Card>
      <CardTitle hint="с начала месяца">Реклама</CardTitle>
      {ads ? (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
            <Stat
              label="Потрачено"
              value={mln(ads.spend)}
              sub={ads.spendUsd ? `$${String(Math.round(ads.spendUsd)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}` : null}
            />
            <Stat label="Касса месяца" value={mln(ads.cash)} />
            <div className="min-w-0">
              <dt className="text-xs text-gray-500">ROAS</dt>
              <dd className="font-display font-semibold text-[15px] tabular-nums" style={{ color: ads.roas >= 3 ? STATUS.good : STATUS.bad }}>
                1 : {Math.round(ads.roas)}
              </dd>
            </div>
            <Stat label="ROMI" value={`${String(ads.romi).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}%`} />
            <Stat label="Цена лида" value={ads.leadCost != null ? money(ads.leadCost) : "—"} />
            <Stat label="Стоимость оплаты" value={ads.payCost != null ? money(ads.payCost) : "—"} />
          </dl>
          {ads.usdRate > 0 && (
            <p className="text-xs text-gray-500 mt-3">Курс $1 = {String(ads.usdRate.toFixed(1)).replace(".", ",")} ₸ (из таблицы)</p>
          )}
        </>
      ) : (
        <Empty>В таблице «Оплаты» этого месяца нет блока «Сумма затрат».</Empty>
      )}
    </Card>
  );
}


function PoWarn({ title, list }) {
  if (Array.isArray(list) ? !list.length : !list) return null;
  if (!Array.isArray(list))
    return (
      <p className="text-xs text-amber-400 mt-2">
        {title}: {list}
      </p>
    );
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-amber-400 text-xs">
        {title}: {list.length}
      </summary>
      <ul className="mt-2 space-y-1">
        {list.map((d, i) => (
          <li key={i} className="flex justify-between gap-3 text-xs">
            <span className="truncate">
              {d.client} · {d.m}
            </span>
            <span className="text-gray-500 shrink-0">
              {d.day}
              {d.st ? ` · ${d.st}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function PrepayCard({ prepay, leads }) {
  return (
    <Card>
      <CardTitle hint="с начала месяца">Предоплаты</CardTitle>
      {prepay ? (
        <>
          <p className="font-display font-bold text-2xl tabular-nums">
            {prepay.total}
            <span className="text-sm text-gray-400 font-sans font-normal ml-2">
              {plural(prepay.total, "предоплата", "предоплаты", "предоплат")} · закрыто{" "}
              {share(prepay.total - prepay.open, prepay.total)}%
            </span>
          </p>
          <div className="mt-3">
            <StackBar items={prepay.rows.map((r) => ({ label: r.k, v: r.v, color: poColor(r.k) }))} total={prepay.total} />
          </div>
          {leads > 0 && (
            <p className="text-xs text-gray-500 mt-3">
              Лидов за месяц: {leads} · ПО → продажа {share(prepay.sold, prepay.total)}%
            </p>
          )}
          <PoWarn title="Оплатили, но в ПО не «Продал»" list={prepay.paidNotSold} />
          <PoWarn title="«ПО = да» в оплатах, но нет в списке ПО" list={prepay.notInList} />
        </>
      ) : (
        <Empty>В списке «ПО» этого месяца пока нет предоплат.</Empty>
      )}
    </Card>
  );
}

/* ---------- Менеджеры: графики над карточками ---------- */
function FactPlanColumns({ rows, people }) {
  const W = 320;
  const H = 150;
  const n = Math.max(rows.length, 1);
  const slot = W / n;
  const bw = Math.min(40, slot * 0.6);
  const mx = Math.max(1, ...rows.map((r) => Math.max(r.s, r.plan)));
  const y = (v) => H - (v / mx) * (H - 22);
  return (
    <svg viewBox={`0 0 ${W} ${H + 34}`} className="w-full h-auto" role="img" aria-label="Факт против плана по менеджерам">
      {rows.map((r, i) => {
        const x = i * slot + (slot - bw) / 2;
        const c = colorFor(r.name, people);
        return (
          <g key={r.name}>
            <rect x={x} y={y(r.s)} width={bw} height={Math.max(H - y(r.s), 1)} rx="4" style={{ fill: c }}>
              <title>{`${r.name}: ${mln(r.s)}${r.plan ? ` из ${mln(r.plan)}` : ""}`}</title>
            </rect>
            {r.plan > 0 && (
              <line x1={x - 5} x2={x + bw + 5} y1={y(r.plan)} y2={y(r.plan)} strokeWidth="2" strokeDasharray="4 3" style={{ stroke: "rgb(var(--c-text))" }} />
            )}
            <text x={x + bw / 2} y={Math.min(y(r.s), r.plan ? y(r.plan) : H) - 6} textAnchor="middle" fontSize="10" fontWeight="600" style={{ fill: "rgb(var(--c-text))" }}>
              {(r.s / 1e6).toFixed(1).replace(".", ",")}
            </text>
            <text x={x + bw / 2} y={H + 14} textAnchor="middle" fontSize="10" style={{ fill: "rgb(var(--c-text))" }}>
              {r.name.length > 9 ? r.name.slice(0, 8) + "…" : r.name}
            </text>
            {r.pct != null && (
              <text x={x + bw / 2} y={H + 28} textAnchor="middle" fontSize="10" style={{ fill: "rgb(var(--c-muted))" }}>
                {r.pct}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function ManagersCharts({ view }) {
  const rows = view.managers.filter((m) => m.s > 0 || m.plan > 0);
  if (!rows.length) return null;
  const people = view.people;
  const mxN = Math.max(1, ...rows.map((m) => m.n));
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle hint="млн ₸ · пунктир — план">Факт против плана</CardTitle>
        <FactPlanColumns rows={rows} people={people} />
      </Card>
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Количество продаж</CardTitle>
          <Donut
            items={rows.map((m) => ({ label: m.name, v: m.n, color: colorFor(m.name, people) }))}
            center={[rows.reduce((a, m) => a + m.n, 0), "продаж"]}
            fmt={(v) => `${v} шт`}
            label="Продажи по менеджерам"
          />
        </Card>
        <Card>
          <CardTitle hint="бледное — с ПО, яркое — без">С предоплатой и без</CardTitle>
          <ul className="space-y-3">
            {rows
              .filter((m) => m.n)
              .map((m) => {
                const c = colorFor(m.name, people);
                return (
                  <li key={m.name} className="text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="truncate">{m.name}</span>
                      <span className="text-gray-400 shrink-0 tabular-nums">
                        {m.po} + {m.nopo}
                      </span>
                    </div>
                    <div className="flex h-2 mt-1 rounded-full overflow-hidden bg-dark-700 gap-0.5" style={{ width: `${(m.n / mxN) * 100}%` }}>
                      {m.po > 0 && <span style={{ width: `${(m.po / m.n) * 100}%`, background: c, opacity: 0.4 }} />}
                      {m.nopo > 0 && <span style={{ width: `${(m.nopo / m.n) * 100}%`, background: c }} />}
                    </div>
                  </li>
                );
              })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
