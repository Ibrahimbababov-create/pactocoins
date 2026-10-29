import { loadSheetSales } from "@/lib/sheetsRevenue";
import { getSheetSources, sourcesForMonth, findAlias, sheetSkipKey } from "@/lib/sheetConfig";
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
function matchUser(sheetName, users, projectId, aliases, fired = []) {
  // Привязка руками старше любых догадок: админ уже сказал, кто это.
  const alias = findAlias(aliases, projectId, sheetName);
  if (alias) {
    // Привязать можно и к уволенному: оплаты бывших сотрудников тоже в таблице.
    const pinned = users.find((u) => u.id === alias.userId) ?? fired.find((u) => u.id === alias.userId);
    if (pinned) return { user: pinned, ambiguous: [] };
  }

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
  const [sheet, usersRes, firedRes, reqRes, projRes] = await Promise.all([
    live.length ? loadSheetSales(live) : { ok: true, rows: [], failed: [] },
    admin
      .from("users")
      .select("id, name, telegram_id, project_id, role, rop_id")
      .eq("is_active", true)
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local"),
    admin
      .from("users")
      .select("id, name, telegram_id, project_id, role, rop_id")
      .eq("is_active", false)
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local"),
    admin
      .from("revenue_requests")
      .select("user_id, project_id, amount_kzt, status, product_kind")
      .in("status", ["approved", "pending"])
      .gte("earned_at", range.start)
      .lt("earned_at", range.end),
    // Если колонки ещё нет в базе, запрос вернёт ошибку: тогда считаем, что
    // интенсивы входят в план у всех.
    admin.from("projects").select("id, intensive_in_plan"),
  ]);
  if (usersRes.error) throw new Error(usersRes.error.message);
  if (reqRes.error) throw new Error(reqRes.error.message);

  const users = usersRes.data ?? [];
  // Уволенных к автопоиску не подмешиваем (чтобы не путать с живыми
  // тёзками), они нужны только для ручной привязки.
  const fired = firedRes.error ? [] : firedRes.data ?? [];
  // Проекты, где мастер-классы не входят в план: в таблицу их не вносят,
  // поэтому в сравнении со стороны PactoCoins их оплаты не считаем.
  // Рейтинг и коины это не затрагивает.
  const noIntensiveProjects = new Set(
    projRes.error ? [] : (projRes.data ?? []).filter((p) => p.intensive_in_plan === false).map((p) => p.id)
  );
  const projectOfUser = new Map(users.concat(fired).map((u) => [u.id, u.project_id]));
  const excludedByProject = {};
  const app = {};
  for (const r of reqRes.data ?? []) {
    // Проект оплаты — тот, где она была внесена, а не текущий проект человека:
    // после перевода в другую команду старая выручка остаётся на старом месте.
    const pid = r.project_id ?? projectOfUser.get(r.user_id);
    if (r.product_kind === "intensive" && pid && noIntensiveProjects.has(pid)) {
      if (allowed && !allowed.has(pid)) continue;
      const e = (excludedByProject[pid] ||= { count: 0, kzt: 0 });
      e.count += 1;
      e.kzt += Number(r.amount_kzt) || 0;
      continue;
    }
    const a = (app[`${r.user_id}|${pid}`] ||= { approved: 0, pending: 0 });
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

  // Кого решили не сверять (оплаты мимо таблиц — например, мастер-классы).
  const skipped = new Set(config.excluded ?? []);

  const matched = new Set();
  const skippedSheets = [];
  const rows = [];
  for (const g of bySheetName.values()) {
    const { user, ambiguous } = matchUser(g.name, users, g.projectId, config.aliases, fired);
    // Строку (или её человека) решили не сверять: прячем из списка.
    const sKey = sheetSkipKey(g.projectId, g.name);
    if (skipped.has(sKey)) {
      skippedSheets.push({ id: sKey, name: g.name, projectId: g.projectId, sheetName: g.name, sheet: true });
      continue;
    }
    if (user) matched.add(`${user.id}|${g.projectId}`);
    if (user && skipped.has(user.id)) continue;
    const a = (user && app[`${user.id}|${g.projectId}`]) || { approved: 0, pending: 0 };
    rows.push({
      sheetName: g.name,
      project: g.project,
      projectId: g.projectId,
      sheetKzt: g.kzt,
      sheetDeals: g.deals,
      user: user ? { id: user.id, name: user.name, hasTelegram: Boolean(user.telegram_id) } : null,
      // Привязано руками — значит имя в таблице само по себе не совпало,
      // и это видно в карточке: можно переназначить или снять.
      linked: Boolean(findAlias(config.aliases, g.projectId, g.name)),
      ambiguous,
      approved: a.approved,
      pending: a.pending,
      missing: Math.max(0, g.kzt - a.approved - a.pending),
      extra: Math.max(0, a.approved + a.pending - g.kzt),
    });
  }

  // Люди проекта, у которых в PactoCoins есть выручка, а в таблице их нет:
  // тоже повод сверить (запись не туда, другая таблица или ошибка).
  const opened = new Set(
    live
      .filter((src) => !(sheet.failed ?? []).some((f) => f.projectId === src.projectId))
      .map((src) => src.projectId)
  );
  const userById = new Map(users.map((u) => [u.id, u]));
  for (const [key, a] of Object.entries(app)) {
    const [userId, pid] = key.split("|");
    const u = userById.get(userId);
    if (!u || matched.has(key) || !opened.has(pid)) continue;
    if (skipped.has(u.id)) continue;
    if (a.approved + a.pending <= 0) continue;
    const src = live.find((x) => x.projectId === pid);
    rows.push({
      sheetName: null,
      project: src.project,
      projectId: pid,
      sheetKzt: 0,
      sheetDeals: 0,
      user: { id: u.id, name: u.name, hasTelegram: Boolean(u.telegram_id) },
      linked: false,
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
    // Исключённые из сверки МК по проектам: { projectId: { count, kzt } }.
    intensiveExcluded: excludedByProject,
    excluded: [
      ...users.concat(fired).filter((u) => skipped.has(u.id)).map((u) => ({ id: u.id, name: u.name })),
      ...skippedSheets,
    ],
    // Для привязки имени руками: кого вообще можно выбрать. РОПу — только
    // своих: весь состав компании ему и не нужен, и видеть его незачем.
    people: users
      .concat(fired)
      .filter((u) => !allowed || allowed.has(u.project_id))
      .map((u) => ({
        id: u.id,
        name: u.name,
        projectId: u.project_id,
        is_active: !fired.includes(u),
        // Для выбора с поиском: он группирует людей по командам РОПов.
        role: u.role,
        rop_id: u.rop_id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    monthLabel: range.label,
    rows,
    totals: rows.reduce(
      (t, r) => ({
        sheet: t.sheet + r.sheetKzt,
        app: t.app + r.approved + r.pending,
        missing: t.missing + r.missing,
        missingCount: t.missingCount + (r.missing > 0 ? 1 : 0),
        extra: t.extra + r.extra,
        extraCount: t.extraCount + (r.extra > 0 ? 1 : 0),
      }),
      { sheet: 0, app: 0, missing: 0, missingCount: 0, extra: 0, extraCount: 0 }
    ),
  };
}

// Меньше этого не напоминаем: копейки расхождения — обычно округление.
export const REMIND_MIN_KZT = 5000;

// Текст напоминания: на «ты», без длинных тире, с конкретными цифрами.
// Обратный случай: в PactoCoins записано больше, чем стоит в таблице.
// Тон спокойный: чаще это не приписка, а пустая ячейка в таблице или
// оплата, которую туда не внесли. Человеку нужно проверить, а не
// оправдываться.
export function reconcileExtraText(row, monthLabel) {
  const n = (v) => Math.round(v).toLocaleString("ru-RU");
  const recorded = row.approved + row.pending;
  return (
    `Сверка за ${monthLabel}.\n\n` +
    `Записано в PactoCoins: ${n(recorded)} ₸\n` +
    `В таблице команды: ${n(row.sheetKzt)} ₸\n` +
    `В приложении больше на: ${n(row.extra)} ₸\n\n` +
    `Посмотри, откуда разница. Обычно одно из трёх: сумму не проставили в ` +
    `таблице, оплату туда не внесли, или в PactoCoins запись ушла дважды ` +
    `либо не с той суммой.\n\n` +
    `Если лишнее в PactoCoins, скажи, поправим. Если дырка в таблице, ` +
    `допиши туда, иначе цифры команды не сходятся.`
  );
}

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
