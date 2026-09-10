// /today и /todayteam — сколько оплат сделано за сегодня (по Алматы).
// Данные из Google Sheets команд (каждая вкладка = менеджер): берём строки,
// где «Дата Продажи» = сегодня, суммируем «Сумма продажи». Порт старого
// sales-bot (load_today_data). Кэш 60 сек в памяти инстанса.

const TZ = "Asia/Almaty";
const CACHE_TTL_MS = 60000;

// project — как показываем; dateCol/amountCol — 0-индекс; данные с 3-й строки.
const TODAY_SOURCES = [
  {
    project: "Арман",
    spreadsheetId: "1GveymbCcp_9Yv2P5PliZPG4G_OHoLVeFgZ4klbQ2MQU",
    dateCol: 1, // B — Дата Продажи
    amountCol: 8, // I — «Сумма продажи»
  },
  {
    project: "Шолпан",
    spreadsheetId: "1kTtkgZAEWIyH8w90-vSHvImh432mk0ezoMj6YYZ3grY",
    dateCol: 1, // B — Дата Продажи
    amountCol: 9, // J — «Сумма продажи» (шаблон сдвинут на 1 колонку)
  },
];

// вкладки, которые не считаем (сводные / архив по месяцам / база)
const SKIP = [
  "янв", "феврал", "март", "апрел", "май", "июн", "июл", "август",
  "сент", "октя", "ноябр", "декабр", "база", "base", "общ", "итог",
  "свод", "план",
];

let cache = { ts: 0, data: null };

function todayAlmaty() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
}

// --- парсеры (порт из sales-bot) ---
export function parseAmount(x) {
  let s = String(x == null ? "" : x).trim();
  if (!s) return 0;
  s = s.replace(/[₸\s]/g, "");

  const hasComma = s.indexOf(",") !== -1;
  const hasDot = s.indexOf(".") !== -1;
  if (hasComma && hasDot) {
    const cut = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
    s = s.slice(0, cut);
  } else if (hasComma) {
    const parts = s.split(",");
    if (parts[parts.length - 1].length <= 2) s = parts.slice(0, -1).join(",") || parts[0];
    s = s.replace(/,/g, "");
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts[parts.length - 1].length <= 2) s = parts.slice(0, -1).join(".") || parts[0];
    s = s.replace(/\./g, "");
  }

  s = s.replace(/[^\d-]/g, "");
  if (s === "" || s === "-") return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

export function parseSheetDate(x) {
  const t = String(x == null ? "" : x).trim();
  if (!t) return null;
  let m = t.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/); // dd.mm.yyyy / dd/mm/yy
  if (m) {
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return y + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  }
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // yyyy-mm-dd
  if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
  return null;
}

export function fmtAmount(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// --- CSV ---
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function fetchText(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms || 6000);
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: "follow" });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function sheetTabs(id) {
  const html = await fetchText(
    "https://docs.google.com/spreadsheets/d/" + id + "/htmlview"
  );
  if (!html) return [];
  const tabs = [];
  const re = /name:\s*"([^"]+)"[^}]*?gid:\s*"(\d+)"/g;
  let m;
  while ((m = re.exec(html))) tabs.push({ name: m[1], gid: m[2] });
  return tabs;
}

async function tabRows(id, gid) {
  const csv = await fetchText(
    "https://docs.google.com/spreadsheets/d/" + id + "/export?format=csv&gid=" + gid
  );
  if (!csv || csv.lastIndexOf("<!DOCTYPE", 0) === 0) return null; // логин-стена
  return parseCsv(csv);
}

export async function loadTodayData() {
  if (cache.data && Date.now() - cache.ts < CACHE_TTL_MS) return cache.data;

  const today = todayAlmaty();
  const out = [];

  for (const src of TODAY_SOURCES) {
    const tabs = await sheetTabs(src.spreadsheetId);
    if (!tabs.length) continue; // недоступная таблица — пропускаем

    const seen = new Set();
    const jobs = tabs
      .filter((tb) => {
        if (seen.has(tb.gid)) return false;
        seen.add(tb.gid);
        return !SKIP.some((k) => tb.name.toLowerCase().indexOf(k) !== -1);
      })
      .map(async (tb) => {
        const rows = await tabRows(src.spreadsheetId, tb.gid);
        if (!rows || rows.length < 3) return;
        for (const r of rows.slice(2)) {
          if (r.length <= Math.max(src.dateCol, src.amountCol)) continue;
          if (parseSheetDate(r[src.dateCol]) !== today) continue;
          const amount = parseAmount(r[src.amountCol]);
          if (amount <= 0) continue;
          out.push({ name: tb.name.trim(), project: src.project, amount });
        }
      });
    await Promise.all(jobs);
  }

  cache = { ts: Date.now(), data: out };
  return out;
}

export function renderToday(rows) {
  if (!rows.length) return "Сегодня оплат нет";
  const map = new Map(); // "name|project" -> { name, project, amount }
  for (const it of rows) {
    const key = it.name + "|" + it.project;
    const g = map.get(key) || { name: it.name, project: it.project, amount: 0 };
    g.amount += it.amount;
    map.set(key, g);
  }
  const sorted = [...map.values()].sort((a, b) => b.amount - a.amount);
  let total = 0;
  const lines = sorted.map((g, i) => {
    total += g.amount;
    return (i + 1) + ". " + g.name + " [" + g.project + "] — " + fmtAmount(g.amount);
  });
  return "Сегодня:\n\n" + lines.join("\n") + "\n\nИтого: " + fmtAmount(total);
}

export function renderTodayTeam(rows) {
  if (!rows.length) return "Сегодня оплат нет";
  const map = new Map();
  for (const it of rows) map.set(it.project, (map.get(it.project) || 0) + it.amount);
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  let total = 0;
  const lines = sorted.map((e, i) => {
    total += e[1];
    return (i + 1) + ". " + e[0] + " — " + fmtAmount(e[1]);
  });
  return "Сегодня по командам:\n\n" + lines.join("\n") + "\n\nИтого: " + fmtAmount(total);
}
