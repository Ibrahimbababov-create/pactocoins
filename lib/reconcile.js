import { loadSheetSales } from "@/lib/sheetsRevenue";
import { getSheetSources, sourcesForMonth } from "@/lib/sheetConfig";
import { monthRangeAlmaty } from "@/lib/timezone";

// Сверка: сколько у человека продаж в Google-таблице за месяц и сколько он
// записал в PactoCoins. Разница — оплаты, которые не внесены: за них нет ни
// коинов, ни места в рейтинге и топе группы.

// Имя → слова в одной «латинской» записи, чтобы совпали «Мансур» и
// «Mansur», «Гульнара» и «Gulnara», «Анджелика» и «Анжелика».
const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "iu", я: "ia",
  ә: "a", ғ: "g", қ: "k", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
};
const wordKey = (w) =>
  [...w]
    .map((c) => TRANSLIT[c] ?? c)
    .join("")
    .replace(/dzh|dj|zh/g, "j")
    .replace(/kh/g, "h")
    .replace(/x/g, "ks")
    .replace(/w/g, "v")
    .replace(/q/g, "k")
    .replace(/y/g, "i")
    .replace(/(.)\1+/g, "$1");

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-zа-яёәғқңөұүһі0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(wordKey);

// «Даниил» ↔ «Ким Даниил», «Виталий» ↔ «Виталий Сапфир»: совпадение
// полного имени или всех слов из таблицы. Подходят двое — не угадываем.
// Сначала ищем среди людей проекта, потом среди всех.
function matchUser(sheetName, users, projectId) {
  const sheetWords = norm(sheetName);
  if (!sheetWords.length) return { user: null, ambiguous: [] };
  const full = sheetWords.join(" ");
  const pools = [users.filter((u) => u.project_id === projectId), users];
  let ambiguous = [];
  for (const pool of pools) {
    const exact = pool.filter((u) => norm(u.name).join(" ") === full);
    if (exact.length === 1) return { user: exact[0], ambiguous: [] };
    const byWord = pool.filter((u) => {
      const w = norm(u.name);
      return sheetWords.every((sw) => w.includes(sw));
    });
    if (byWord.length === 1) return { user: byWord[0], ambiguous: [] };
    if (!ambiguous.length) ambiguous = (byWord.length ? byWord : exact).map((u) => u.name);
  }
  // Последний шанс, только среди людей проекта: слово — начало другого
  // («Султан РОП» ↔ «Sula ROP»), от 4 букв.
  if (!ambiguous.length) {
    const near = (a, b) => a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a));
    const byPrefix = pools[0].filter((u) => {
      const w = norm(u.name);
      return sheetWords.every((sw) => w.some((uw) => uw === sw || near(uw, sw)));
    });
    if (byPrefix.length === 1) return { user: byPrefix[0], ambiguous: [] };
  }
  return { user: null, ambiguous };
}

// projectIds — для РОПа: только таблицы его проектов. null — все (админ).
export async function getReconcile(admin, monthKey, { projectIds = null } = {}) {
  const range = monthRangeAlmaty(monthKey);
  const config = await getSheetSources(admin);
  const allowed = projectIds ? new Set(projectIds) : null;
  const monthSources = sourcesForMonth(config.sources, monthKey);
  // sources — для формы (у таблицы прошлого месяца подставим колонки),
  // читаем только таблицы, сохранённые именно на этот месяц.
  const sources = allowed ? monthSources.filter((s) => allowed.has(s.projectId)) : monthSources;
  const live = sources.filter((s) => s.month === monthKey);
  const [sheet, usersRes, reqRes] = await Promise.all([
    live.length ? loadSheetSales(live) : { ok: true, rows: [], failed: [] },
    admin
      .from("users")
      .select("id, name, telegram_id, project_id")
      .eq("is_active", true)
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local"),
    admin
      .from("revenue_requests")
      .select("user_id, amount_kzt, status")
      .in("status", ["approved", "pending"])
      .gte("earned_at", range.start)
      .lt("earned_at", range.end),
  ]);
  if (usersRes.error) throw new Error(usersRes.error.message);
  if (reqRes.error) throw new Error(reqRes.error.message);

  const users = usersRes.data ?? [];
  const app = {};
  for (const r of reqRes.data ?? []) {
    const a = (app[r.user_id] ||= { approved: 0, pending: 0 });
    a[r.status] += Number(r.amount_kzt) || 0;
  }

  const bySheetName = new Map();
  for (const s of sheet.rows) {
    if (!s.day.startsWith(monthKey)) continue;
    if (allowed && !allowed.has(s.projectId)) continue;
    const key = `${s.project}|${s.name}`;
    const g = bySheetName.get(key) ?? {
      name: s.name,
      project: s.project,
      projectId: s.projectId,
      kzt: 0,
      deals: 0,
    };
    g.kzt += s.amount;
    g.deals += 1;
    bySheetName.set(key, g);
  }

  const matched = new Set();
  const rows = [...bySheetName.values()].map((g) => {
    const { user, ambiguous } = matchUser(g.name, users, g.projectId);
    if (user) matched.add(user.id);
    const a = user ? app[user.id] ?? { approved: 0, pending: 0 } : { approved: 0, pending: 0 };
    return {
      sheetName: g.name,
      project: g.project,
      projectId: g.projectId,
      sheetKzt: g.kzt,
      sheetDeals: g.deals,
      user: user ? { id: user.id, name: user.name, hasTelegram: Boolean(user.telegram_id) } : null,
      ambiguous,
      approved: a.approved,
      pending: a.pending,
      missing: Math.max(0, g.kzt - a.approved - a.pending),
      extra: Math.max(0, a.approved + a.pending - g.kzt),
    };
  });

  // Люди проекта, у которых в PactoCoins есть выручка, а в таблице их нет:
  // тоже повод сверить (запись не туда, другая таблица или ошибка).
  const opened = new Set(
    live
      .filter((src) => !(sheet.failed ?? []).some((f) => f.projectId === src.projectId))
      .map((src) => src.projectId)
  );
  for (const u of users) {
    if (matched.has(u.id) || !opened.has(u.project_id)) continue;
    const a = app[u.id];
    if (!a || a.approved + a.pending <= 0) continue;
    const src = live.find((x) => x.projectId === u.project_id);
    rows.push({
      sheetName: null,
      project: src.project,
      projectId: u.project_id,
      sheetKzt: 0,
      sheetDeals: 0,
      user: { id: u.id, name: u.name, hasTelegram: Boolean(u.telegram_id) },
      ambiguous: [],
      approved: a.approved,
      pending: a.pending,
      missing: 0,
      extra: a.approved + a.pending,
    });
  }
  rows.sort((x, y) => y.missing - x.missing || y.extra - x.extra);

  return {
    ok: sheet.ok,
    failedSheets: (sheet.failed ?? []).map((f) => f.project),
    failedReasons: Object.fromEntries((sheet.failed ?? []).map((f) => [f.projectId, f.reason])),
    sources,
    liveCount: live.length,
    sourcesUpdatedAt: config.updatedAt,
    monthLabel: range.label,
    rows,
    totals: rows.reduce(
      (t, r) => ({
        sheet: t.sheet + r.sheetKzt,
        app: t.app + r.approved + r.pending,
        missing: t.missing + r.missing,
      }),
      { sheet: 0, app: 0, missing: 0 }
    ),
  };
}

// Меньше этого не напоминаем: копейки расхождения — обычно округление.
export const REMIND_MIN_KZT = 5000;

// Текст напоминания: на «ты», без длинных тире, с конкретными цифрами.
export function reconcileReminderText(row, monthLabel) {
  const n = (v) => Math.round(v).toLocaleString("ru-RU");
  const recorded = row.approved + row.pending;
  return (
    `Сверка за ${monthLabel}.\n\n` +
    `В таблице у тебя: ${n(row.sheetKzt)} ₸\n` +
    `Записано в PactoCoins: ${n(recorded)} ₸\n` +
    `Не хватает: ${n(row.missing)} ₸\n\n` +
    `Допиши эти оплаты в PactoCoins через «Записать выручку». Дату оплаты можно выбрать задним числом.\n\n` +
    `Пока оплата не записана, за неё нет ни коинов, ни места в рейтинге и в /top5.`
  );
}
