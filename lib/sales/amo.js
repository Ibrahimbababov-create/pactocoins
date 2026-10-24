// amoCRM для раздела «Аналитика»: «Работа команды», «Квота на сегодня»,
// причины отказов. Перенесено из дашборда arman-analytics (api/_amo.js).
// Только чтение. Токен — долгосрочный токен внешней интеграции, лежит в
// переменной из dept.amo.tokenEnv (AMO_TOKEN_ARMAN, AMO_TOKEN_SHOLPAN…).
// Только на сервере.

const WON = 142;
const LOST = 143;
const TZ = 5 * 3600; // Алматы, UTC+5

export const hasAmo = (dept) => !!(dept?.amo && process.env[dept.amo.tokenEnv]);

// не больше 6 запросов к одному amo одновременно — у amo лимит около 7 в секунду
const gates = new Map();
function gate(domain) {
  if (!gates.has(domain)) gates.set(domain, { busy: 0, waiting: [] });
  const g = gates.get(domain);
  return {
    take: () => (g.busy < 6 ? (g.busy++, Promise.resolve()) : new Promise((ok) => g.waiting.push(ok))),
    free: () => {
      const next = g.waiting.shift();
      if (next) next();
      else g.busy--;
    },
  };
}

async function amo(cfg, path) {
  const g = gate(cfg.domain);
  await g.take();
  try {
    let r;
    for (let i = 0; i < 4; i++) {
      r = await fetch(`https://${cfg.domain}/api/v4${path}`, {
        headers: { Authorization: `Bearer ${process.env[cfg.tokenEnv]}` },
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      }).catch((e) => ({ ok: false, status: 0, statusText: e.message }));
      // лимит amo или сбой сети — переждать и повторить
      if (r.status !== 429 && r.status !== 0) break;
      await new Promise((ok) => setTimeout(ok, 700 * (i + 1)));
    }
    if (r.status === 204) return null;
    if (!r.ok) throw new Error(`amoCRM ответил ${r.status}`);
    return r.json();
  } finally {
    g.free();
  }
}

// все страницы списка (amo отдаёт до 250 за раз; у событий — до 100)
async function all(cfg, path, key, { per = 250, pages = 12 } = {}) {
  const out = [];
  for (let p = 1; p <= pages; p++) {
    const j = await amo(cfg, `${path}${path.includes("?") ? "&" : "?"}limit=${per}&page=${p}`);
    const arr = j?._embedded?.[key] || [];
    out.push(...arr);
    if (arr.length < per) break;
  }
  return out;
}

// ---------- кэш в памяти экземпляра ----------
const cache = new Map();
async function cached(key, ttlMs, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v;
  if (hit?.p) return hit.p;
  const p = load()
    .then((v) => {
      cache.set(key, { t: Date.now(), v });
      return v;
    })
    .catch((e) => {
      cache.delete(key);
      if (hit?.v) return hit.v; // amo споткнулся — лучше прошлые цифры, чем ничего
      throw e;
    });
  cache.set(key, { ...(hit || { t: 0 }), p });
  return p;
}

// справочники (воронки, этапы, пользователи) меняются редко — час
const dicts = (cfg) =>
  cached(`dicts:${cfg.domain}`, 3600e3, async () => {
    const [p, u] = await Promise.all([amo(cfg, "/leads/pipelines"), amo(cfg, "/users?limit=250")]);
    const pipes = {};
    const statuses = {};
    const stages = {};
    const users = {};
    (p?._embedded?.pipelines || []).forEach((x) => {
      pipes[x.id] = x.name;
      const st = (x._embedded?.statuses || []).sort((a, b) => a.sort - b.sort);
      stages[x.id] = st.map((s) => ({ id: s.id, name: s.name }));
      st.forEach((s) => (statuses[s.id] = s.name));
    });
    (u?._embedded?.users || []).forEach((x) => (users[x.id] = x.name));
    return { pipes, statuses, stages, users };
  });

async function salesPipeline(cfg) {
  const d = await dicts(cfg);
  const want = String(cfg.pipeline || "").toLowerCase();
  const hit = Object.entries(d.pipes).find(([id, n]) => id === want || n.toLowerCase().includes(want));
  if (!hit) throw new Error(`в amo не нашёл воронку «${cfg.pipeline}»`);
  return { id: +hit[0], name: hit[1] };
}

const openStages = (d, p) => (d.stages[p.id] || []).filter((s) => s.id !== WON && s.id !== LOST);
const dayStart = () => {
  const now = Math.floor(Date.now() / 1000);
  return Math.floor((now + TZ) / 86400) * 86400 - TZ; // полночь по Алматы
};
const hourOf = (sec) => new Date((sec + TZ) * 1000).getUTCHours();
// реакцию считаем в рабочем времени: заявка ночью «приходит» в 9:00 по Алматы
function workStart(sec) {
  const h = hourOf(sec);
  if (h >= 9 && h < 21) return sec;
  const day = Math.floor((sec + TZ) / 86400) * 86400 - TZ;
  return day + 9 * 3600 + (h >= 21 ? 86400 : 0);
}
const pipeOf = (v) => v?.[0]?.lead_status?.pipeline_id;

const EV_TYPES = ["outgoing_chat_message", "lead_status_changed", "task_completed", "lead_added", "outgoing_call"];

// Сырые данные amo за период — без деления на отделы (оно делается после,
// чтобы два отдела в одном amo не читали его дважды)
async function loadRaw(cfg, period) {
  const now = Math.floor(Date.now() / 1000);
  const d0 = dayStart();
  const [from, to] = { yesterday: [d0 - 86400, d0], week: [d0 - 6 * 86400, null] }[period] || [d0, null];
  const [d, p] = await Promise.all([dicts(cfg), salesPipeline(cfg)]);
  const rng = `filter[updated_at][from]=${from}` + (to ? `&filter[updated_at][to]=${to + 3600}` : "");
  const st = openStages(d, p);
  const leadFilter = st.length
    ? st.map((s, i) => `filter[statuses][${i}][pipeline_id]=${p.id}&filter[statuses][${i}][status_id]=${s.id}`).join("&")
    : `filter[pipeline_id][]=${p.id}`;

  // за неделю событий тысячи, а amo отдаёт их по 100 — читаем по дням
  // параллельно, иначе не уложиться в лимит времени функции на Vercel
  const end = to || now;
  const windows = [];
  for (let a = from; a < end; a += 86400) windows.push([a, Math.min(a + 86400, end)]);
  const evq = EV_TYPES.map((t) => "filter[type][]=" + t).join("&");
  const [calls, ev, open, cohort, overdue] = await Promise.all([
    Promise.all(
      ["leads", "contacts"].map((e) =>
        all(cfg, `/${e}/notes?filter[note_type][]=call_in&filter[note_type][]=call_out&${rng}`, "notes", { pages: 20 })
          .then((a) => a.map((n) => ({ ...n, _e: e })))
          .catch(() => [])
      )
    ).then((a) => a.flat().filter((n) => n.created_at >= from && (!to || n.created_at < to))),
    Promise.all(
      windows.map(([a, b]) =>
        all(cfg, `/events?filter[created_at][from]=${a}&filter[created_at][to]=${b - 1}&${evq}`, "events", { per: 100, pages: 30 }).catch(() => [])
      )
    ).then((parts) => {
      const seen = new Set();
      return parts.flat().filter((e) => !seen.has(e.id) && seen.add(e.id));
    }),
    all(cfg, `/leads?${leadFilter}&order[updated_at]=desc`, "leads", { pages: 20 }).then((a) =>
      a.filter((l) => l.status_id !== WON && l.status_id !== LOST)
    ),
    all(cfg, `/leads?filter[pipeline_id][]=${p.id}&filter[created_at][from]=${now - 30 * 86400}`, "leads", { pages: 10 }).catch(() => []),
    all(cfg, `/tasks?filter[is_completed]=0&filter[complete_till][to]=${now}&filter[entity_type]=leads&order[complete_till]=asc`, "tasks", {
      pages: 8,
    }).catch(() => []),
  ]);

  // активность по людям
  const M = {};
  const row = (id) =>
    (M[d.users[id] || "АТС / без пользователя"] ||= { calls: 0, talks: 0, dials: 0, min: 0, msg: 0, st: 0, done: 0, add: 0, leads: new Set(), hours: Array(24).fill(0) });
  calls.forEach((n) => {
    const r = row(n.responsible_user_id || n.created_by);
    const dur = +n.params?.duration || 0;
    r.calls++;
    if (dur > 0) r.dials++;
    if (dur >= 60) r.talks++;
    r.min += dur / 60;
    if (n._e === "leads") r.leads.add(n.entity_id);
    r.hours[hourOf(n.created_at)]++;
  });
  const invoices = {}; // кто сколько выставил счетов (переход на этап со «счёт»)
  ev.forEach((e) => {
    if (e.type === "outgoing_call") return; // звонки уже посчитаны по примечаниям
    const r = row(e.created_by);
    if (e.type === "outgoing_chat_message") {
      r.msg++;
      r.hours[hourOf(e.created_at)]++;
    } else if (e.type === "lead_status_changed") {
      r.st++;
      r.hours[hourOf(e.created_at)]++;
      const sid = e.value_after?.[0]?.lead_status?.id;
      if (/сч[её]т/i.test(d.statuses[sid] || "")) {
        const who = d.users[e.created_by] || "без пользователя";
        (invoices[who] ||= new Set()).add(e.entity_id);
      }
    } else if (e.type === "task_completed") r.done++;
    else if (e.type === "lead_added") r.add++;
    if (e.entity_type === "lead") r.leads.add(e.entity_id);
  });
  const activity = Object.entries(M).map(([name, r]) => ({
    name,
    calls: r.calls,
    dials: r.dials,
    talks: r.talks,
    min: Math.round(r.min),
    msg: r.msg,
    st: r.st,
    done: r.done,
    leads: r.leads.size,
    hours: r.hours,
  }));

  // скорость реакции: заявка попала в воронку → первый исходящий звонок или сообщение
  const entries = {};
  ev.forEach((e) => {
    if (e.entity_type !== "lead") return;
    const inP =
      pipeOf(e.value_after) === p.id &&
      (e.type === "lead_added" || (e.type === "lead_status_changed" && pipeOf(e.value_before) !== p.id));
    if (inP && !(entries[e.entity_id] <= e.created_at)) entries[e.entity_id] = e.created_at;
  });
  const ids = Object.keys(entries).map(Number);
  const info = {};
  const byContact = {};
  for (let i = 0; i < ids.length; i += 50) {
    const j = await amo(cfg, `/leads?with=contacts&limit=50&${ids.slice(i, i + 50).map((x) => "filter[id][]=" + x).join("&")}`).catch(() => null);
    (j?._embedded?.leads || []).forEach((l) => {
      info[l.id] = l;
      (l._embedded?.contacts || []).forEach((c) => (byContact[c.id] ||= []).push(l.id));
    });
  }
  const touches = {};
  const touch = (ent, id, t) =>
    (ent === "lead" || ent === "leads" ? [id] : byContact[id] || []).forEach((l) => (touches[l] ||= []).push(t));
  ev.forEach((e) => {
    if (e.type === "outgoing_call" || e.type === "outgoing_chat_message") touch(e.entity_type, e.entity_id, e.created_at);
  });
  calls.forEach((n) => {
    if (n.note_type === "call_out") touch(n._e, n.entity_id, n.created_at);
  });
  const reactionLeads = ids.map((id) => {
    const l = info[id];
    const start = workStart(entries[id]);
    const first = (touches[id] || []).filter((t) => t >= entries[id] - 60).sort((a, b) => a - b)[0];
    return {
      id,
      name: l?.name || "сделка " + id,
      resp: d.users[l?.responsible_user_id] || "без ответственного",
      mins: first ? Math.max(0, (first - start) / 60) : null,
      wait: !first && now > start ? Math.round((now - start) / 60) : null,
    };
  });

  const slim = (l) => ({
    id: l.id,
    name: l.name,
    resp: d.users[l.responsible_user_id] || "без ответственного",
    status: l.status_id,
    price: l.price || 0,
    updated: l.updated_at,
    hasTask: !!l.closest_task_at,
  });

  return {
    domain: cfg.domain,
    pipeline: p.name,
    stages: openStages(d, p),
    statuses: d.statuses,
    activity,
    invoices: Object.fromEntries(Object.entries(invoices).map(([k, v]) => [k, v.size])),
    open: open.map(slim),
    cohort: cohort.map((l) => ({ resp: d.users[l.responsible_user_id] || "", status: l.status_id })),
    overdue: overdue.map((t) => ({
      id: t.entity_id,
      text: t.text || "задача",
      resp: d.users[t.responsible_user_id] || "без ответственного",
      days: Math.floor((now - t.complete_till) / 86400),
    })),
    reactionLeads,
    now,
    partial: ev.length >= 6000,
  };
}

const RAW_TTL = { today: 5 * 60e3, yesterday: 30 * 60e3, week: 30 * 60e3 };
export const getRaw = (cfg, period) =>
  cached(`raw:${cfg.domain}:${period}`, RAW_TTL[period] || RAW_TTL.today, () => loadRaw(cfg, period));

// причины отказов: сделки воронки, закрытые без оплаты за месяц
export const getLoss = (cfg, month) =>
  cached(`loss:${cfg.domain}:${month}`, 30 * 60e3, async () => {
    const [d, p] = await Promise.all([dicts(cfg), salesPipeline(cfg)]);
    const from = Math.floor(Date.parse(month + "-01T00:00:00Z") / 1000) - TZ;
    const [y, m] = month.split("-").map(Number);
    const to = Math.floor(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1) / 1000) - TZ;
    const leads = await all(
      cfg,
      `/leads?with=loss_reason&filter[statuses][0][pipeline_id]=${p.id}&filter[statuses][0][status_id]=${LOST}&filter[closed_at][from]=${from}&filter[closed_at][to]=${to}`,
      "leads",
      { pages: 10 }
    );
    return leads
      .filter((l) => !l.closed_at || (l.closed_at >= from && l.closed_at < to))
      .map((l) => ({ resp: d.users[l.responsible_user_id] || "без ответственного", reason: l._embedded?.loss_reason?.[0]?.name || "Причина не указана" }));
  });
