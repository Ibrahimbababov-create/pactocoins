import { nowInAlmaty } from "@/lib/timezone";
import { mln, plural } from "@/lib/sales/format";

// Расчёты для экранов аналитики. Всё считается на сервере, в браузер уходят
// только готовые цифры: без телефонов и полных имён клиентов.
// Формулы те же, что в дашборде arman-analytics (Сводка, Менеджеры).

const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const sum = (arr, f = (x) => x.s) => arr.reduce((a, x) => a + (f(x) || 0), 0);
const dayOf = (d) => +d.slice(8, 10);

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

// Имена из таблиц и из PactoCoins сравниваем по первому слову
export const mkey = (s) => String(s || "").trim().split(/\s+/)[0].toLowerCase().replace(/ё/g, "е");
export const sameName = (a, b) => !!a && !!b && mkey(a) === mkey(b);

export function monthFrac(key) {
  const [y, mo] = key.split("-").map(Number);
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const now = nowInAlmaty();
  const isCur = now.year === y && now.month === mo;
  const day = isCur ? now.day : dim;
  return { dim, day, isCur, fr: day / dim };
}

// Прогноз на конец месяца: текущий темп × дней в месяце (с 3-го дня)
const forecastOf = (s, f) => (f.isCur && f.day >= 3 ? (s / f.day) * f.dim : s);

const pick = (m, f) =>
  f === "all" ? [...m.deals, ...(m.ints || [])] : f === "course" ? m.deals : m.ints || [];

function cumulative(items, f) {
  const out = [];
  let acc = 0;
  const last = f.isCur ? f.day : f.dim;
  for (let i = 1; i <= last; i++) {
    items.forEach((d) => {
      if (dayOf(d.d) === i) acc += d.s;
    });
    out.push(acc);
  }
  return out;
}

function managersOf(m) {
  return [...new Set([...Object.keys(m.plan || {}), ...m.deals.map((d) => d.m), ...(m.ints || []).map((i) => i.m)])];
}

function agg(m) {
  const A = {};
  const get = (k) =>
    A[k] || (A[k] = { n: 0, s: 0, net: 0, po: 0, b: 0, ints: 0, intS: 0, ages: [], plan: (m.plan || {})[k] || 0 });
  managersOf(m).forEach(get);
  m.deals.forEach((d) => {
    const a = get(d.m);
    if (!d.x) {
      a.n++;
      a.po += d.po ? 1 : 0;
    }
    a.s += d.s;
    a.net += d.net;
    a.b += d.b || 0;
    if (d.c) {
      const age = Math.round((new Date(d.d) - new Date(d.c)) / 864e5);
      if (age >= 0) a.ages.push(age);
    }
  });
  (m.ints || []).forEach((i) => {
    const a = get(i.m);
    a.ints++;
    a.intS += i.s;
  });
  return A;
}

function mondayKey(ds) {
  const d = new Date(ds + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const MON_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const shortDay = (key) => `${+key.slice(8, 10)} ${MON_SHORT[+key.slice(5, 7) - 1]}`;

function weeks(m) {
  const W = {};
  m.deals.forEach((d) => {
    const k = mondayKey(d.d);
    const w = W[k] || (W[k] = { k, n: 0, s: 0 });
    if (!d.x) w.n++;
    w.s += d.s;
  });
  return Object.values(W)
    .sort((a, b) => (a.k < b.k ? -1 : 1))
    .map((w) => {
      const end = new Date(w.k + "T00:00:00Z");
      end.setUTCDate(end.getUTCDate() + 6);
      return { ...w, label: `${shortDay(w.k)} – ${shortDay(end.toISOString().slice(0, 10))}` };
    });
}

function groupBy(items, keyOf) {
  const G = {};
  items.forEach((d) => {
    const k = keyOf(d) || "не указан";
    const g = G[k] || (G[k] = { k, n: 0, s: 0, net: 0 });
    if (!d.x) g.n++;
    g.s += d.s;
    g.net += d.net ?? d.s;
  });
  return Object.values(G).sort((a, b) => b.s - a.s);
}

// Короткие выводы под сводкой — как «Что важно» в дашборде
function insights(m, A, t, f) {
  const out = [];
  const planned = Object.entries(A).filter(([, a]) => a.plan > 0);
  if (f.isCur && t.plan) {
    const need = Math.round(f.fr * 100);
    const got = pc(t.g, t.plan);
    const left = Math.max(0, t.plan - t.g);
    out.push([
      got >= need ? "ok" : "warn",
      `Прошло ${need}% месяца, план закрыт на ${got}%. ` +
        (got >= need ? "Идём быстрее темпа." : `Чтобы идти в темпе, сейчас должно быть ${mln(t.plan * f.fr)}.`) +
        ` До конца месяца нужно ещё ${mln(left)} — это ${mln(left / Math.max(1, f.dim - f.day + 1))} в день.`,
    ]);
  }
  if (t.plan && f.fr >= 0.33) {
    const over = planned.filter(([, a]) => a.s >= a.plan);
    const share = pc(sum(over, ([, a]) => a.s), t.g);
    if (over.length && over.length < planned.length && share >= 70)
      out.push(["warn", `${share}% выручки сделали ${over.map(([k]) => k).join(" и ")}. Отдел держится на сильных.`]);
    planned
      .filter(([, a]) => a.n === 0)
      .forEach(([k, a]) =>
        out.push(["bad", `${k} — 0 продаж курса при плане ${mln(a.plan)}${a.ints ? `, только ${a.ints} интенсивов` : ""}.`])
      );
    planned
      .filter(([, a]) => a.n > 0 && a.s < a.plan * 0.5)
      .forEach(([k, a]) => out.push(["bad", `${k} — ${pc(a.s, a.plan)}% плана: ${a.n} продаж.`]));
  }
  const lost = t.g - t.n;
  if (t.g && lost > 0) out.push(["warn", `Комиссии забрали ${mln(lost)} — ${pc(lost, t.g)}% от суммы продаж.`]);
  const W = weeks(m);
  if (W.length > 1) {
    const b = W.reduce((x, y) => (y.s > x.s ? y : x));
    out.push(["ok", `Лучшая неделя — ${b.label}: ${b.n} ${plural(b.n, "продажа", "продажи", "продаж")} на ${mln(b.s)}.`]);
  }
  return out;
}

const maskClient = (n) => {
  const [a, b] = String(n || "").split(/\s+/);
  return b ? `${a} ${b[0]}.` : a || "—";
};

// Всё для экранов одного месяца отдела.
// withDeals — добавить список оплат (только РОПу и руководству).
export function buildMonthView(months, key, { withDeals = false } = {}) {
  const m = months[key];
  if (!m) return null;
  const keys = Object.keys(months).sort();
  const prev = months[keys[keys.indexOf(key) - 1]];
  const f = monthFrac(key);
  const A = agg(m);

  const t = {
    g: sum(m.deals),
    n: sum(m.deals, (d) => d.net),
    plan: Object.values(m.plan || {}).reduce((a, b) => a + b, 0),
    sales: m.deals.filter((d) => !d.x).length,
  };

  const filters = {};
  ["all", "course", "int"].forEach((fk) => {
    const P = pick(m, fk);
    const total = sum(P);
    let delta = null;
    if (prev) {
      const prevTotal = sum(pick(prev, fk).filter((d) => !f.isCur || dayOf(d.d) <= f.day));
      if (prevTotal) delta = Math.round((total / prevTotal - 1) * 100);
    }
    filters[fk] = {
      total,
      count: P.length,
      avg: P.length ? total / P.length : 0,
      net: sum(P, (d) => d.net ?? d.s),
      forecast: f.isCur && f.day >= 3 ? forecastOf(total, f) : null,
      delta,
      cum: cumulative(P, f),
    };
  });

  const managers = Object.entries(A)
    .map(([name, a]) => {
      const all = pick(m, "all").filter((d) => d.m === name);
      return {
        name,
        plan: a.plan,
        s: a.s,
        net: a.net,
        n: a.n,
        po: a.po,
        nopo: a.n - a.po,
        ints: a.ints,
        intS: a.intS,
        cycle: median(a.ages),
        bonus: a.b,
        pct: a.plan ? pc(a.s, a.plan) : null,
        forecastPct: f.isCur && a.plan ? pc(forecastOf(a.s, f), a.plan) : null,
        payments: all.length,
        revenue: sum(all),
      };
    })
    .filter((x) => x.revenue || x.plan)
    .sort((x, y) => y.revenue - x.revenue);

  const view = {
    key,
    label: m.label,
    planInherited: m.inherited,
    frac: f,
    plan: t.plan,
    planPct: t.plan ? pc(t.g, t.plan) : null,
    paceNeed: Math.round(f.fr * 100),
    course: t.g,
    courseNet: t.n,
    sales: t.sales,
    leads: m.leads || 0,
    conversion: m.leads && t.sales ? Math.round((t.sales / m.leads) * 1000) / 10 : null,
    filters,
    managers,
    funnels: [
      { label: "Курс", v: sum(m.deals) },
      { label: "Интенсив", v: sum(m.ints || []) },
    ],
    tariffs: ["Групповой", "VIP"].map((k) => {
      const d = m.deals.filter((x) => x.t === k);
      return { label: k, n: d.filter((x) => !x.x).length, s: sum(d) };
    }),
    insights: insights(m, A, t, f),
    perManager: {},
  };

  // Страница одного менеджера
  managers.forEach(({ name }) => {
    const mine = m.deals.filter((d) => d.m === name);
    const mineAll = pick(m, "all").filter((d) => d.m === name);
    view.perManager[name] = {
      cum: cumulative(mineAll, f),
      forms: groupBy(mine, (d) => d.p).slice(0, 8),
      sources: groupBy(mine, (d) => d.src).slice(0, 8),
      deals: withDeals
        ? mineAll
            .slice()
            .sort((a, b) => (a.d < b.d ? 1 : -1))
            .map((d) => ({
              d: d.d,
              day: shortDay(d.d),
              client: maskClient(d.n),
              s: d.s,
              tariff: d.t || "Интенсив",
              form: d.p && d.p !== "—" ? d.p : null,
              extra: !!d.x,
              po: !!d.po,
              url: d.url || null,
            }))
        : null,
    };
  });

  return view;
}

export function monthList(months) {
  return Object.keys(months)
    .sort()
    .reverse()
    .map((k) => ({ key: k, label: months[k].label }));
}
