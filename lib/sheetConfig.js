import { SHEET_SOURCES } from "@/lib/sheetsRevenue";

// Таблицы команд меняются каждый месяц — ссылки держим не в коде, а в
// маленьком JSON-файле в закрытом бакете Supabase (app-config/sheets.json).
// Схему базы это не меняет. Меняют админ и РОПы на странице «Сверка»:
// у каждой таблицы есть месяц, за который она (month).
const BUCKET = "app-config";
const FILE = "sheets.json";

// «I» → 8, «J» → 9 (0-индекс колонки).
export const colToIndex = (letter) => {
  const s = String(letter || "").trim().toUpperCase();
  if (!/^[A-Z]{1,2}$/.test(s)) return null;
  return [...s].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
};
export const indexToCol = (i) => {
  let n = Number(i) + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

// Из ссылки вида https://docs.google.com/spreadsheets/d/<id>/edit… — id.
export function spreadsheetIdFrom(input) {
  const s = String(input || "").trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : null;
}

// Месяц таблицы. У старых записей его не было — тогда месяц сохранения,
// у таблиц по умолчанию — сентябрь 2026.
export const sourceMonth = (s) => s.month || s.savedMonth || "2026-09";

// Таблица каждого проекта для месяца: сохранённая на этот месяц, а если её
// нет — последняя более ранняя. Сверка читает только таблицы ровно этого
// месяца; более раннюю показываем в форме, чтобы подставить колонки.
export function sourcesForMonth(sources, monthKey) {
  const best = new Map();
  for (const s of sources) {
    const m = sourceMonth(s);
    if (m > monthKey) continue;
    const key = s.projectId ?? s.project;
    const cur = best.get(key);
    if (!cur || m > sourceMonth(cur)) best.set(key, s);
  }
  return [...best.values()].map((s) => ({ ...s, month: sourceMonth(s) }));
}

// Сколько месяцев истории держим на проект.
const KEEP_MONTHS = 3;

// Заменить таблицу проекта за месяц, остальные месяцы не трогать.
export function upsertSource(sources, source) {
  const key = (s) => s.projectId ?? s.project;
  const others = sources
    .map((s) => ({ ...s, month: sourceMonth(s) }))
    .filter((s) => !(key(s) === key(source) && s.month === source.month));
  const mine = [source, ...others.filter((s) => key(s) === key(source))]
    .sort((x, y) => (x.month < y.month ? 1 : -1))
    .slice(0, KEEP_MONTHS);
  return [...others.filter((s) => key(s) !== key(source)), ...mine];
}

export async function getSheetSources(admin) {
  try {
    const { data, error } = await admin.storage.from(BUCKET).download(FILE);
    if (error || !data) return { sources: SHEET_SOURCES, updatedAt: null, fromDefaults: true };
    const parsed = JSON.parse(await data.text());
    if (!Array.isArray(parsed?.sources) || !parsed.sources.length) {
      return { sources: SHEET_SOURCES, updatedAt: null, fromDefaults: true };
    }
    return { sources: parsed.sources, updatedAt: parsed.updatedAt ?? null, fromDefaults: false };
  } catch {
    return { sources: SHEET_SOURCES, updatedAt: null, fromDefaults: true };
  }
}

export async function saveSheetSources(admin, sources) {
  // Бакет создаём при первом сохранении. Закрытый: читать его может
  // только сервер (service role).
  const { data: buckets } = await admin.storage.listBuckets();
  if (!(buckets ?? []).some((b) => b.id === BUCKET)) {
    const { error } = await admin.storage.createBucket(BUCKET, { public: false });
    if (error && !/exists/i.test(error.message)) return { error: error.message };
  }
  const body = JSON.stringify({ sources, updatedAt: new Date().toISOString() }, null, 2);
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(FILE, body, { contentType: "application/json", upsert: true });
  return error ? { error: error.message } : { ok: true };
}
