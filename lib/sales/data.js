import { listSpreadsheets, readSpreadsheet } from "@/lib/sales/google";
import { parseBook, buildMonths } from "@/lib/sales/parse";
import { mkey } from "@/lib/sales/metrics";

// Данные отдела по месяцам. Google перечитываем не чаще раза в 3 минуты,
// а каждую таблицу — только если она изменилась (по modifiedTime).
// Кэш живёт в памяти серверного экземпляра: после холодного старта
// таблицы просто читаются заново, это пара секунд.

const TTL_MS = 3 * 60 * 1000;
const cache = new Map(); // источник -> { t, files: { id: { modified, book } }, months }
const pending = new Map(); // источник -> Promise, чтобы не читать одно и то же параллельно
const sourceOf = (dept) => dept.source || dept.id;

async function load(dept, prev) {
  const listed =
    dept.folderId || dept.nameQuery
      ? await listSpreadsheets({ folderId: dept.folderId, nameQuery: dept.nameQuery })
      : [];
  // Таблицы, заданные напрямую: дату изменения не знаем — перечитываем раз в TTL
  const seen = new Set(listed.map((f) => f.id));
  const files = [
    ...listed,
    ...(dept.spreadsheetIds || [])
      .filter((id) => !seen.has(id))
      .map((id) => ({ id, name: id, modifiedTime: null })),
  ];
  const next = {};
  const failed = [];
  await Promise.all(
    files.map(async (f) => {
      const old = prev?.files?.[f.id];
      if (old && f.modifiedTime && old.modified === f.modifiedTime) {
        next[f.id] = old;
        return;
      }
      try {
        const raw = await readSpreadsheet(f.id);
        next[f.id] = { name: raw.title, modified: f.modifiedTime, book: parseBook(raw, { skipSheets: dept.skipSheets }) };
      } catch (e) {
        console.error("sales sheet", dept.id, f.name, e.message);
        failed.push(f.name);
        if (old) next[f.id] = old;
      }
    })
  );
  const books = Object.values(next).map((x) => x.book);
  // строки с оплатой, но без понятной даты — их не видно в цифрах, поэтому показываем РОПу
  const issues = Object.values(next).flatMap((x) =>
    (x.book.issues || []).map((i) => ({ ...i, file: x.name }))
  );
  return { t: Date.now(), files: next, months: buildMonths(books), fileCount: files.length, failed, issues };
}

// Несколько отделов в одних таблицах: оставляем оплаты своего отдела.
// Строка без колонки «Отдел» относится к отделу менеджера — по его последней
// продаже, где отдел указан. Менеджер, которого не удалось отнести ни к
// одному отделу, попадает в unassigned — РОП увидит, кого распределить.
function forDivision(data, division, manual = {}) {
  const latest = {}; // менеджер -> { d, o }
  Object.values(data.months).forEach((m) =>
    [...m.deals, ...(m.ints || [])].forEach((x) => {
      if (!x.o) return;
      const k = mkey(x.m);
      if (!latest[k] || x.d >= latest[k].d) latest[k] = { d: x.d, o: x.o };
    })
  );
  const fixed = Object.fromEntries(Object.entries(manual).map(([k, v]) => [mkey(k), v]));
  const divOf = (name) => fixed[mkey(name)] || latest[mkey(name)]?.o || null;
  const mine = (x) => (x.o || divOf(x.m)) === division;
  const unassigned = new Set();

  // «кого распределить» смотрим только за два последних месяца: старые хвосты не важны
  const recent = new Set(Object.keys(data.months).sort().slice(-2));
  const flag = (name) => {
    if (/[a-zа-яё]/i.test(name) && !divOf(name)) unassigned.add(name);
  };

  const months = {};
  Object.entries(data.months).forEach(([k, m]) => {
    if (recent.has(k)) {
      [...m.deals, ...(m.ints || [])].forEach((x) => !x.o && flag(x.m));
      Object.keys(m.plan || {}).forEach(flag);
    }
    const deals = m.deals.filter(mine);
    const ints = (m.ints || []).filter(mine);
    if (!deals.length && !ints.length) return;
    months[k] = {
      ...m,
      deals,
      ints,
      po: (m.po || []).filter((p) => divOf(p.m) === division),
      plan: Object.fromEntries(Object.entries(m.plan || {}).filter(([name]) => divOf(name) === division)),
      // лиды и расходы в таблице общие на все отделы — делить их не на что
      leads: 0,
      spend: 0,
    };
  });
  return { ...data, months, unassigned: [...unassigned] };
}

export async function getDepartmentMonths(dept) {
  const data = await getSourceData(dept);
  return dept.division ? forDivision(data, dept.division, dept.managerDivisions) : data;
}

async function getSourceData(dept) {
  const key = sourceOf(dept);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL_MS) return hit;
  if (pending.has(key)) return pending.get(key);

  const p = load(dept, hit)
    .then((data) => {
      cache.set(key, data);
      return data;
    })
    .catch((e) => {
      // Google временно недоступен — лучше показать прошлые цифры, чем ничего
      if (hit) return hit;
      throw e;
    })
    .finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}
