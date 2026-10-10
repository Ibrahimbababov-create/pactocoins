// Выручка из Google-таблиц команд — для сверки с PactoCoins в админке.
// Раньше этими таблицами считал /today старый sales-bot; парсеры перенесены
// оттуда (lib/salesToday.js до октября 2026). Читаем публичный CSV: таблица
// должна быть открыта «Все, у кого есть ссылка» (читатель).

const CACHE_TTL_MS = 5 * 60 * 1000;

// Таблицы по умолчанию, пока на странице «Сверка» ничего не сохранили.
// Дальше таблицы месяца вставляют на странице, они хранятся через
// lib/sheetConfig.js. Колонки — 0-индекс (A = 0).
export const SHEET_SOURCES = [
  // Октябрь: сводный лист «Общее», A — менеджер, D — «Факт тотал».
  {
    project: "Арман",
    projectId: "0521eee9-4498-4584-9ed2-95464f4c4e2a",
    month: "2026-10",
    spreadsheetId: "1ghBm0BV_QOrOvw9of3WSSbx72OEDFPxNzGMjFpSteBI", // «Оплаты Арман Октябрь»
    layout: "sheet",
    tab: "Общее",
    nameCol: 0,
    amountCol: 3,
  },
  {
    project: "Шолпан",
    projectId: "a757e308-809a-4f45-8827-54f0de83fb68",
    month: "2026-10",
    spreadsheetId: "1tZSqex5cyJg_cOJ7Zsdjq20Y29LeFmlRO1DinyyYt38", // «Оплаты Шолпан Октябрь»
    layout: "sheet",
    tab: "Общее",
    nameCol: 0,
    amountCol: 3,
  },
  // Сентябрь: каждый лист = менеджер.
  {
    project: "Арман",
    projectId: "0521eee9-4498-4584-9ed2-95464f4c4e2a", // «Арман Tiktok»
    month: "2026-09",
    spreadsheetId: "1GveymbCcp_9Yv2P5PliZPG4G_OHoLVeFgZ4klbQ2MQU",
    dateCol: 1, // B — Дата Продажи
    amountCol: 8, // I — «Сумма продажи»
  },
  {
    project: "Шолпан",
    projectId: "a757e308-809a-4f45-8827-54f0de83fb68", // «Шолпан»
    month: "2026-09",
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

const TOTAL_ROW = /^(итог|всего|total|сумма)/i;

let cache = { ts: 0, key: null, data: null };

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
    const res = await fetch(url, { signal: ctl.signal, redirect: "follow", cache: "no-store" });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Таблица целиком: { tabs: [{ name, gid }], read(names) → { имя: строки[][] } }.
// null — не открылась (нет доступа по ссылке или неверная ссылка).
async function openBook(id) {
  const html = await fetchText("https://docs.google.com/spreadsheets/d/" + id + "/htmlview");
  if (!html) return null;
  const tabs = [];
  const seen = new Set();
  const re = /name:\s*"([^"]+)"[^}]*?gid:\s*"(\d+)"/g;
  let m;
  while ((m = re.exec(html))) {
    if (seen.has(m[2])) continue;
    seen.add(m[2]);
    tabs.push({ name: m[1], gid: m[2] });
  }
  if (!tabs.length) return null;
  return {
    tabs,
    async read(names) {
      const out = {};
      await Promise.all(
        names.map(async (n) => {
          const tab = tabs.find((t) => t.name === n);
          const csv = await fetchText(
            "https://docs.google.com/spreadsheets/d/" + id + "/export?format=csv&gid=" + tab.gid
          );
          if (!csv || csv.lastIndexOf("<!DOCTYPE", 0) === 0) return; // логин-стена
          out[n] = parseCsv(csv);
        })
      );
      return out;
    },
  };
}

const CLOSED = "таблица не открылась: включи доступ «Все, у кого есть ссылка» (читатель)";

const sameName = (a, b) => String(a).trim().toLowerCase() === String(b || "").trim().toLowerCase();

// Как устроена таблица проекта (настраивается на странице «Сверка»):
// - layout "tabs": каждый лист = менеджер, имя — название листа;
//   dateCol/amountCol — колонки даты и суммы, startRow — с какой строки
//   данные (1 = первая), по умолчанию 3;
// - layout "sheet": один лист tab, где у менеджера строка или строки:
//   nameCol — имя, amountCol — сумма (например «Факт»). Даты нет — всё на
//   листе относится к месяцу таблицы. Шапку и пустые строки пропускаем
//   сами: в них нет суммы.
// month — месяц, за который эта таблица ("YYYY-MM").
async function readSource(src) {
  const book = await openBook(src.spreadsheetId);
  if (!book) return { ok: false, rows: [], reason: CLOSED };

  const base = { project: src.project, projectId: src.projectId ?? null };
  const rows = [];
  const take = (r, name, day) => {
    const amount = parseAmount(r[src.amountCol]);
    if (!name || amount <= 0 || !day) return;
    rows.push({ ...base, name, day, amount });
  };

  if (src.layout === "sheet") {
    const tab = book.tabs.find((t) => sameName(t.name, src.tab));
    if (!tab) return { ok: false, rows: [], reason: `в таблице нет листа «${src.tab}»` };
    const data = (await book.read([tab.name]))[tab.name];
    if (!data) return { ok: false, rows: [], reason: CLOSED };
    const day = `${src.month || src.savedMonth}-01`;
    for (const r of data) {
      const name = String(r[src.nameCol] ?? "").trim();
      // «Итоги» — конец списка менеджеров: ниже на сводном листе обычно
      // другие таблички (затраты, ROAS, конверсии), это не продажи.
      if (TOTAL_ROW.test(name)) {
        if (rows.length) break;
        continue;
      }
      // имя без букв («$1 570») и проценты/доли в сумме — не продажа
      if (!/\p{L}/u.test(name) || /[%:]/.test(String(r[src.amountCol] ?? ""))) continue;
      take(r, name, day);
    }
    return { ok: true, rows };
  }

  const start = Math.max(1, Number(src.startRow) || 3) - 1;
  const names = book.tabs
    .filter((tb) => !SKIP.some((k) => tb.name.toLowerCase().indexOf(k) !== -1))
    .map((tb) => tb.name);
  const data = await book.read(names);
  for (const n of names) {
    for (const r of (data[n] ?? []).slice(start)) take(r, n.trim(), parseSheetDate(r[src.dateCol]));
  }
  return { ok: true, rows };
}

// Названия листов таблицы — для выбора на странице «Сверка».
export async function listSheetTabs(spreadsheetId) {
  const book = await openBook(spreadsheetId);
  return book ? { tabs: book.tabs.map((t) => t.name) } : { error: CLOSED };
}

// Проверка настроек до сохранения: как сервер понял строки.
export async function previewSource(src) {
  const res = await readSource(src);
  if (!res.ok) return { ok: false, reason: res.reason };
  // Как в сверке — только месяц таблицы, иначе итог не совпадёт.
  const rows = res.rows.filter((r) => r.day.startsWith(src.month));
  return {
    ok: true,
    otherMonths: res.rows.length - rows.length,
    count: rows.length,
    total: rows.reduce((t, r) => t + r.amount, 0),
    people: new Set(rows.map((r) => r.name)).size,
    sample: rows.slice(0, 8).map(({ name, day, amount }) => ({ name, day, amount })),
  };
}

// Все строки продаж из таблиц: [{ name, project, projectId, day: "YYYY-MM-DD", amount }].
// Недоступная таблица пропускается: failed — [{ project, projectId, reason }];
// ok=false — не открылась ни одна.
export async function loadSheetSales(sources = SHEET_SOURCES) {
  const cacheKey = JSON.stringify(sources);
  if (cache.data && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL_MS) {
    return cache.data;
  }

  const rows = [];
  let opened = 0;
  const failed = [];
  const results = await Promise.all(sources.map((src) => readSource(src)));
  results.forEach((res, i) => {
    if (!res.ok) {
      const s = sources[i];
      failed.push({ project: s.project, projectId: s.projectId ?? null, reason: res.reason });
      return;
    }
    opened++;
    rows.push(...res.rows);
  });

  const result = { ok: opened > 0 || !sources.length, rows, failed };
  cache = { ts: Date.now(), key: cacheKey, data: result };
  return result;
}
