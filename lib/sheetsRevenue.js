import { currentMonthKeyAlmaty } from "@/lib/timezone";

// Выручка из Google-таблиц команд (каждая вкладка = менеджер) — для сверки
// с PactoCoins в админке. Раньше этими таблицами считал /today старый
// sales-bot; код чтения перенесён оттуда без изменений (lib/salesToday.js
// до октября 2026). Таблицы открыты по ссылке, читаем публичный CSV.

const CACHE_TTL_MS = 5 * 60 * 1000;

// Таблицы по умолчанию (сентябрь 2026). Актуальные ссылки месяца админ
// вставляет на странице «Сверка» — они хранятся в lib/sheetConfig.js.
// project — как подписано в таблицах; dateCol/amountCol — 0-индекс,
// данные с 3-й строки.
export const SHEET_SOURCES = [
  {
    project: "Арман",
    projectId: "0521eee9-4498-4584-9ed2-95464f4c4e2a", // «Арман Tiktok»
    spreadsheetId: "1GveymbCcp_9Yv2P5PliZPG4G_OHoLVeFgZ4klbQ2MQU",
    dateCol: 1, // B — Дата Продажи
    amountCol: 8, // I — «Сумма продажи»
  },
  {
    project: "Шолпан",
    projectId: "a757e308-809a-4f45-8827-54f0de83fb68", // «Шолпан»
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

// Как устроена таблица проекта (настраивается на странице «Сверка»):
// - layout "tabs" (по умолчанию): каждый лист = менеджер, имя — название
//   листа; dateCol/amountCol — колонки даты и суммы;
// - layout "sheet": один лист tab со всеми продажами; nameCol — колонка
//   имени, amountCol — суммы, dateCol — даты (можно не указывать: тогда
//   весь лист считается за месяц savedMonth, когда ссылку сохранили).
// startRow — с какой строки начинаются данные (1 = первая), по умолчанию 3.
async function readSource(src) {
  const tabs = await sheetTabs(src.spreadsheetId);
  if (!tabs.length) return { ok: false, rows: [], reason: "таблица не открылась" };

  const start = Math.max(1, Number(src.startRow) || 3) - 1;
  const hasDate = src.dateCol !== null && src.dateCol !== undefined && src.dateCol !== "";
  const fallbackDay = `${src.savedMonth || currentMonthKeyAlmaty()}-01`;
  const base = { project: src.project, projectId: src.projectId ?? null };
  const rows = [];

  const take = (r, name) => {
    const amount = parseAmount(r[src.amountCol]);
    if (!name || amount <= 0) return;
    const day = hasDate ? parseSheetDate(r[src.dateCol]) : fallbackDay;
    if (!day) return;
    rows.push({ ...base, name, day, amount });
  };

  if (src.layout === "sheet") {
    const tab = tabs.find((t) => t.name.trim().toLowerCase() === String(src.tab || "").trim().toLowerCase());
    if (!tab) return { ok: false, rows: [], reason: `нет листа «${src.tab}»` };
    const data = await tabRows(src.spreadsheetId, tab.gid);
    if (!data) return { ok: false, rows: [], reason: "лист не открылся" };
    for (const r of data.slice(start)) {
      const name = String(r[src.nameCol] ?? "").trim();
      // строка «Итого» внизу листа — не менеджер, иначе сумма задвоится
      if (TOTAL_ROW.test(name)) continue;
      take(r, name);
    }
    return { ok: true, rows };
  }

  const seen = new Set();
  await Promise.all(
    tabs
      .filter((tb) => {
        if (seen.has(tb.gid)) return false;
        seen.add(tb.gid);
        return !SKIP.some((k) => tb.name.toLowerCase().indexOf(k) !== -1);
      })
      .map(async (tb) => {
        const data = await tabRows(src.spreadsheetId, tb.gid);
        if (!data) return;
        for (const r of data.slice(start)) take(r, tb.name.trim());
      })
  );
  return { ok: true, rows };
}

// Названия листов таблицы — для выбора на странице «Сверка».
export async function listSheetTabs(spreadsheetId) {
  const tabs = await sheetTabs(spreadsheetId);
  const seen = new Set();
  return tabs.filter((t) => !seen.has(t.gid) && seen.add(t.gid)).map((t) => t.name);
}

// Проверка настроек до сохранения: как сервер понял первые строки.
export async function previewSource(src) {
  const res = await readSource(src);
  if (!res.ok) return { ok: false, reason: res.reason };
  // Как в сверке — только текущий месяц, иначе итог не совпадёт.
  const month = currentMonthKeyAlmaty();
  const rows = res.rows.filter((r) => r.day.startsWith(month));
  return {
    ok: true,
    otherMonths: res.rows.length - rows.length,
    count: rows.length,
    total: rows.reduce((t, r) => t + r.amount, 0),
    people: new Set(rows.map((r) => r.name)).size,
    sample: rows.slice(0, 8).map(({ name, day, amount }) => ({ name, day, amount })),
  };
}

// Все строки продаж из таблиц: [{ name, project, day: "YYYY-MM-DD", amount }].
// Недоступная таблица пропускается; ok=false — не открылась ни одна.
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
      failed.push(sources[i].project);
      return;
    }
    opened++;
    rows.push(...res.rows);
  });

  const result = { ok: opened > 0, rows, failed };
  cache = { ts: Date.now(), key: cacheKey, data: result };
  return result;
}
