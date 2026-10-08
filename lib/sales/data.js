import { listSpreadsheets, readSpreadsheet } from "@/lib/sales/google";
import { parseBook, buildMonths } from "@/lib/sales/parse";

// Данные отдела по месяцам. Google перечитываем не чаще раза в 3 минуты,
// а каждую таблицу — только если она изменилась (по modifiedTime).
// Кэш живёт в памяти серверного экземпляра: после холодного старта
// таблицы просто читаются заново, это пара секунд.

const TTL_MS = 3 * 60 * 1000;
const cache = new Map(); // dept.id -> { t, files: { id: { modified, book } }, months }
const pending = new Map(); // dept.id -> Promise, чтобы не читать одно и то же параллельно

async function load(dept, prev) {
  const files = await listSpreadsheets({ folderId: dept.folderId, nameQuery: dept.nameQuery });
  const next = {};
  await Promise.all(
    files.map(async (f) => {
      const old = prev?.files?.[f.id];
      if (old && old.modified === f.modifiedTime) {
        next[f.id] = old;
        return;
      }
      try {
        next[f.id] = {
          name: f.name,
          modified: f.modifiedTime,
          book: parseBook(await readSpreadsheet(f.id)),
        };
      } catch (e) {
        console.error("sales sheet", dept.id, f.name, e.message);
        if (old) next[f.id] = old;
      }
    })
  );
  const books = Object.values(next).map((x) => x.book);
  return { t: Date.now(), files: next, months: buildMonths(books), fileCount: files.length };
}

export async function getDepartmentMonths(dept) {
  const hit = cache.get(dept.id);
  if (hit && Date.now() - hit.t < TTL_MS) return hit;
  if (pending.has(dept.id)) return pending.get(dept.id);

  const p = load(dept, hit)
    .then((data) => {
      cache.set(dept.id, data);
      return data;
    })
    .catch((e) => {
      // Google временно недоступен — лучше показать прошлые цифры, чем ничего
      if (hit) return hit;
      throw e;
    })
    .finally(() => pending.delete(dept.id));
  pending.set(dept.id, p);
  return p;
}
