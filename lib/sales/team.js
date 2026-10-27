import { mkey, maskClient } from "@/lib/sales/metrics";
import { hidePhones } from "@/lib/sales/format";

// «Работа команды» из сырых данных amo (lib/sales/amo.js) для одного отдела.
// people — менеджеры отдела из таблиц; если список пуст, показываем всех.
// aliases — «как в amo» → «как в таблице» (Анжелика → Анджелика).

const WON = 142;
const LOST = 143;
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const h = s.length >> 1;
  return Math.round(s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2);
};
const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function nameMapper(people, aliases = {}) {
  const alias = Object.fromEntries(Object.entries(aliases).map(([k, v]) => [mkey(k), v]));
  const byKey = Object.fromEntries(people.map((p) => [mkey(p), p]));
  // имя из amo → имя из таблицы (или как есть)
  const toTable = (amoName) => {
    const a = alias[mkey(amoName)];
    if (a) return byKey[mkey(a)] || a;
    return byKey[mkey(amoName)] || amoName;
  };
  const keep = people.length ? (amoName) => !!byKey[mkey(toTable(amoName))] : () => true;
  return { toTable, keep };
}

export function buildTeamView(raw, { people = [], aliases = {}, lead = false } = {}) {
  const { toTable, keep } = nameMapper(people, aliases);
  const mine = (amoName) => amoName !== "АТС / без пользователя" && keep(amoName);

  const managers = raw.activity
    .filter((m) => mine(m.name) && m.calls + m.msg + m.st + m.done)
    .map((m) => ({ ...m, name: toTable(m.name) }))
    .sort((a, b) => b.talks * 3 + b.msg + b.st - (a.talks * 3 + a.msg + a.st));

  // реакция на новые заявки
  const R = {};
  raw.reactionLeads
    .filter((l) => mine(l.resp))
    .forEach((l) => {
      const k = toTable(l.resp);
      const r = (R[k] ||= { name: k, n: 0, mins: [], miss: [] });
      r.n++;
      if (l.mins != null) r.mins.push(l.mins);
      else if (l.wait != null) r.miss.push(l);
    });
  const reaction = Object.values(R)
    .map((r) => ({
      name: r.name,
      n: r.n,
      median: median(r.mins),
      in15: r.mins.filter((x) => x <= 15).length,
      in60: r.mins.filter((x) => x <= 60).length,
      miss: r.miss.length,
    }))
    .sort((a, b) => b.n - a.n);
  const missList = lead
    ? Object.values(R)
        .flatMap((r) => r.miss.map((x) => ({ id: x.id, name: maskClient(hidePhones(x.name)), m: r.name, wait: x.wait })))
        .sort((a, b) => b.wait - a.wait)
        .slice(0, 20)
    : null;

  // воронка сейчас и где застревают сделки (без движения 3+ дня)
  const open = raw.open.filter((l) => mine(l.resp));
  const stale = (l) => raw.now - l.updated > 3 * 86400;
  const funnel = raw.stages.map((s) => {
    const arr = open.filter((l) => l.status === s.id);
    const by = {};
    const st = {};
    arr.forEach((l) => {
      const m = toTable(l.resp);
      by[m] = (by[m] || 0) + 1;
      if (stale(l)) st[m] = (st[m] || 0) + 1;
    });
    return { name: s.name, count: arr.length, sum: arr.reduce((a, l) => a + l.price, 0), by, stale: st };
  });

  // конверсия: сделки за 30 дней — сколько дошли до каждого этапа
  const idx = Object.fromEntries(raw.stages.map((s, i) => [s.id, i]));
  const reached = raw.stages.map(() => 0);
  let won = 0;
  let lost = 0;
  const cohort = raw.cohort.filter((l) => mine(l.resp));
  cohort.forEach((l) => {
    if (l.status === WON) {
      won++;
      reached.forEach((_, i) => reached[i]++);
      return;
    }
    if (l.status === LOST) {
      lost++;
      return;
    }
    const i = idx[l.status];
    if (i == null) return;
    for (let k = 0; k <= i; k++) reached[k]++;
  });

  // порядок в amo
  const leadRow = (l) => ({
    id: l.id,
    name: maskClient(hidePhones(l.name)),
    m: toTable(l.resp),
    stage: raw.statuses[l.status] || "",
    days: Math.floor((raw.now - l.updated) / 86400),
  });
  const noTask = open.filter((l) => !l.hasTask).map(leadRow).sort((a, b) => b.days - a.days);
  const staleList = open.filter(stale).map(leadRow).sort((a, b) => b.days - a.days);
  const overdue = raw.overdue.filter((t) => mine(t.resp)).map((t) => ({ ...t, text: hidePhones(t.text), m: toTable(t.resp) }));
  const byPerson = (arr) => {
    const o = {};
    arr.forEach((x) => (o[x.m] = (o[x.m] || 0) + 1));
    return Object.entries(o)
      .map(([k, v]) => ({ k, v }))
      .sort((a, b) => b.v - a.v);
  };

  const sum = (k) => managers.reduce((a, m) => a + m[k], 0);
  const rN = reaction.reduce((a, r) => a + r.n, 0);
  const r15 = reaction.reduce((a, r) => a + r.in15, 0);

  return {
    domain: raw.domain,
    pipeline: raw.pipeline,
    partial: raw.partial,
    kpi: {
      talks: sum("talks"),
      min: sum("min"),
      msg: sum("msg"),
      react15: rN ? pc(r15, rN) : null,
      leadsNew: rN,
      mess: noTask.length + overdue.length,
    },
    managers,
    reaction,
    missList,
    funnel,
    openCount: open.length,
    conv: {
      total: cohort.length,
      won,
      lost,
      stages: raw.stages.map((s, i) => ({ name: s.name, n: reached[i], pct: pc(reached[i], cohort.length) })),
    },
    order: {
      noTaskN: noTask.length,
      staleN: staleList.length,
      overdueN: overdue.length,
      noTaskBy: byPerson(noTask),
      overdueBy: byPerson(overdue),
      // названия сделок — только РОПу и руководству
      noTask: lead ? noTask.slice(0, 30) : null,
      stale: lead ? staleList.slice(0, 30) : null,
      overdue: lead ? overdue.slice(0, 30) : null,
    },
    invoices: Object.fromEntries(
      Object.entries(raw.invoices)
        .filter(([k]) => mine(k))
        .map(([k, v]) => [toTable(k), v])
    ),
  };
}

export function buildLossView(rows, { people = [], aliases = {} } = {}) {
  const { toTable, keep } = nameMapper(people, aliases);
  const mine = rows.filter((r) => keep(r.resp));
  const by = {};
  const byMgr = {};
  mine.forEach((r) => {
    by[r.reason] = (by[r.reason] || 0) + 1;
    const m = toTable(r.resp);
    (byMgr[m] ||= {})[r.reason] = (byMgr[m]?.[r.reason] || 0) + 1;
  });
  return {
    total: mine.length,
    reasons: Object.entries(by)
      .map(([k, v]) => ({ k, v }))
      .sort((a, b) => b.v - a.v),
    byManager: Object.entries(byMgr)
      .map(([m, o]) => ({ m, n: Object.values(o).reduce((a, b) => a + b, 0), top: Object.entries(o).sort((a, b) => b[1] - a[1])[0][0] }))
      .sort((a, b) => b.n - a.n),
  };
}
