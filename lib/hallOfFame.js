import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { almatyDayKey, currentMonthKeyAlmaty } from "@/lib/timezone";

// Зал славы: рекорды компании по подтверждённой выручке. Считаем по всей
// таблице заявок на сервере и держим в кэше 10 минут: страница открывается
// мгновенно, а цифры отстают от жизни не больше чем на десять минут.
// Суточный крон (lib/hallNotify.js) считает то же самое без кэша.

const PAGE = 1000;
const MILLION = 1_000_000;

// Понедельник недели для дня "YYYY-MM-DD" (неделя пн-вс)
function weekStartKey(dayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return dt.toISOString().slice(0, 10);
}

function addDays(dayKey, n) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
  return dt.toISOString().slice(0, 10);
}

function better(cur, value, extra) {
  return !cur || value > cur.value ? { value, ...extra } : cur;
}

export async function computeHallOfFame() {
  const admin = createAdminClient();

  const { data: people } = await admin
    .from("users")
    .select("id, name, is_active, is_guest, email");
  // Рекорды хранятся и за уволенных: история компании не должна пропадать.
  // Гость и тестовые аккаунты не считаются. Лидеры текущего месяца только
  // из активных (activeIds).
  const names = {};
  const activeIds = new Set();
  for (const u of people ?? []) {
    if (u.is_guest) continue;
    if ((u.email ?? "").endsWith(".test@pactocoins.local")) continue;
    names[u.id] = u.name;
    if (u.is_active) activeIds.add(u.id);
  }

  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("revenue_requests")
      .select("id, user_id, amount_kzt, earned_at, created_at, status, product_kind")
      .eq("status", "approved")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const day = {};
  const week = {};
  const month = {};
  const dayCount = {};
  const dayTotal = {};
  const monthTotal = {};
  const perMonthRows = {};
  let bestPayment = null;
  let bestIntensive = null;

  for (const r of rows) {
    if (!(r.user_id in names)) continue;
    const amount = Number(r.amount_kzt) || 0;
    if (amount <= 0) continue;
    const at = r.earned_at || r.created_at;
    const dk = almatyDayKey(at);
    const k1 = `${r.user_id}|${dk}`;
    const k2 = `${r.user_id}|${weekStartKey(dk)}`;
    const k3 = `${r.user_id}|${dk.slice(0, 7)}`;
    day[k1] = (day[k1] ?? 0) + amount;
    week[k2] = (week[k2] ?? 0) + amount;
    month[k3] = (month[k3] ?? 0) + amount;
    dayCount[k1] = (dayCount[k1] ?? 0) + 1;
    bestPayment = better(bestPayment, amount, { userId: r.user_id, at });
    if (r.product_kind === "intensive") {
      bestIntensive = better(bestIntensive, amount, { userId: r.user_id, at });
    }
    dayTotal[dk] = (dayTotal[dk] ?? 0) + amount;
    monthTotal[dk.slice(0, 7)] = (monthTotal[dk.slice(0, 7)] ?? 0) + amount;
    (perMonthRows[k3] ??= []).push({ at: new Date(at).getTime(), dk, amount });
  }

  // Кто быстрее всех набрал миллион за месяц: по дню месяца, при равенстве
  // побеждает тот, кто сделал это раньше по календарю.
  let fastest = null;
  for (const [key, list] of Object.entries(perMonthRows)) {
    list.sort((a, b) => a.at - b.at);
    let sum = 0;
    for (const x of list) {
      sum += x.amount;
      if (sum >= MILLION) {
        const [userId, mk] = key.split("|");
        const dom = Number(x.dk.slice(8, 10));
        if (!fastest || dom < fastest.dom || (dom === fastest.dom && x.dk < fastest.when)) {
          fastest = { dom, value: dom, userId, when: x.dk, monthKey: mk };
        }
        break;
      }
    }
  }

  const top = (map) => {
    let best = null;
    for (const [key, value] of Object.entries(map)) {
      const [userId, when] = key.split("|");
      best = better(best, value, { userId, when });
    }
    return best;
  };

  const bestDay = top(day);
  const bestWeek = top(week);
  const bestMonth = top(month);
  const mostDeals = top(dayCount);

  // Лидер текущего месяца
  const nowKey = currentMonthKeyAlmaty();
  let leader = null;
  for (const [key, value] of Object.entries(month)) {
    const [userId, when] = key.split("|");
    if (when === nowKey && activeIds.has(userId)) leader = better(leader, value, { userId });
  }

  const topDays = Object.entries(dayTotal)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))
    .slice(0, 3)
    .map(([when, value]) => ({ when, value }));

  let companyMonth = null;
  for (const [when, value] of Object.entries(monthTotal)) {
    companyMonth = better(companyMonth, value, { when });
  }
  const companyNow = monthTotal[nowKey] ?? 0;

  const monthTop = Object.entries(month)
    .filter(([key]) => key.split("|")[1] === nowKey && activeIds.has(key.split("|")[0]))
    .map(([key, value]) => ({
      userId: key.split("|")[0],
      value,
      name: names[key.split("|")[0]] ?? "Сотрудник",
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const mostPayMonth = top(
    Object.fromEntries(Object.entries(perMonthRows).map(([k, l]) => [k, l.length]))
  );

  const withName = (rec) =>
    rec
      ? {
          ...rec,
          name: names[rec.userId] ?? "Сотрудник",
          inactive: rec.userId ? !activeIds.has(rec.userId) : false,
        }
      : null;

  return {
    bestDay: withName(bestDay),
    bestWeek: bestWeek
      ? withName({ ...bestWeek, weekEnd: addDays(bestWeek.when, 6) })
      : null,
    bestMonth: withName(bestMonth),
    bestPayment: withName(bestPayment),
    mostDeals: withName(mostDeals),
    leader: withName(leader),
    monthKey: nowKey,
    topDays,
    companyMonth,
    companyNow,
    monthTop,
    mostPayMonth: withName(mostPayMonth),
    bestIntensive: withName(bestIntensive),
    fastest: withName(fastest),
  };
}

export const getHallOfFame = unstable_cache(computeHallOfFame, ["hall-of-fame-v3"], {
  revalidate: 600,
});
