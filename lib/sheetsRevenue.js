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

  for (const src of sources) {
    const tabs = await sheetTabs(src.spreadsheetId);
    if (!tabs.length) {
      failed.push(src.project);
      continue;
    }
    opened++;

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
          if (!data || data.length < 3) return;
          for (const r of data.slice(2)) {
            if (r.length <= Math.max(src.dateCol, src.amountCol)) continue;
            const day = parseSheetDate(r[src.dateCol]);
            const amount = parseAmount(r[src.amountCol]);
            if (!day || amount <= 0) continue;
            rows.push({ name: tb.name.trim(), project: src.project, projectId: src.projectId ?? null, day, amount });
          }
        })
    );
  }

  const result = { ok: opened > 0, rows, failed };
  cache = { ts: Date.now(), key: cacheKey, data: result };
  return result;
}
