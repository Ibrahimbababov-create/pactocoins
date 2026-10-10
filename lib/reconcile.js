import { loadSheetSales } from "@/lib/sheetsRevenue";
import { getSheetSources } from "@/lib/sheetConfig";
import { monthRangeAlmaty } from "@/lib/timezone";

// Сверка: сколько у человека продаж в Google-таблице за месяц и сколько он
// записал в PactoCoins. Разница — оплаты, которые не внесены: за них нет ни
// коинов, ни места в рейтинге и топе группы.

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

// Вкладка «Даниил» ↔ «Ким Даниил», «Виталий» ↔ «Виталий Сапфир»: совпадение
// полного имени или любого слова. Подходят двое — не угадываем.
function matchUser(sheetName, users) {
  const sheetWords = norm(sheetName);
  if (!sheetWords.length) return { user: null, ambiguous: [] };
  const full = sheetWords.join(" ");
  const exact = users.filter((u) => norm(u.name).join(" ") === full);
  if (exact.length === 1) return { user: exact[0], ambiguous: [] };
  const byWord = users.filter((u) => {
    const w = norm(u.name);
    return sheetWords.every((sw) => w.includes(sw));
  });
  if (byWord.length === 1) return { user: byWord[0], ambiguous: [] };
  return { user: null, ambiguous: (byWord.length ? byWord : exact).map((u) => u.name) };
}

// projectIds — для РОПа: только таблицы его проектов. null — все (админ).
export async function getReconcile(admin, monthKey, { projectIds = null } = {}) {
  const range = monthRangeAlmaty(monthKey);
  const config = await getSheetSources(admin);
  const allowed = projectIds ? new Set(projectIds) : null;
  const sources = allowed
    ? config.sources.filter((s) => allowed.has(s.projectId))
    : config.sources;
  const [sheet, usersRes, reqRes] = await Promise.all([
    sources.length ? loadSheetSales(sources) : { ok: true, rows: [], failed: [] },
    admin
      .from("users")
      .select("id, name, telegram_id")
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

  const rows = [...bySheetName.values()].map((g) => {
    const { user, ambiguous } = matchUser(g.name, users);
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
    };
  });
  rows.sort((x, y) => y.missing - x.missing);

  return {
    ok: sheet.ok,
    failedSheets: sheet.failed ?? [],
    sources,
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
