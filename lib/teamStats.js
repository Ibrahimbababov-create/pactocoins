import {
  recentDaysAlmaty,
  almatyDayKey,
  nowInAlmaty,
  monthRangeAlmaty,
  currentMonthKeyAlmaty,
  lastMonthRangeAlmaty,
  thisWeekRangeAlmaty,
} from "@/lib/timezone";

// Сводка по команде РОПа: считается по подтверждённым оплатам (те же
// правила, что в рейтинге: сумма в тенге по дате оплаты). Ничего не пишет,
// только читает. Клиент в admin-режиме: у РОПа нет прав читать оплаты
// подчинённых напрямую, поэтому id команды берём из базы строго по rop_id.

import { QUIET_DAYS, SERIES_DAYS } from "@/lib/teamConstants";

const num = (v) => Number(v) || 0;

export async function getTeamOverview(admin, ropId) {
  const { data: members } = await admin
    .from("users")
    .select("id, name, role, rop_id, created_at")
    .eq("rop_id", ropId)
    .in("role", ["mop", "trainee"])
    .eq("is_active", true)
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local")
    .order("name");

  const people = members ?? [];
  const ids = people.map((m) => m.id);

  const days = recentDaysAlmaty(SERIES_DAYS);
  const todayKey = days[days.length - 1].key;
  const month = monthRangeAlmaty(currentMonthKeyAlmaty());
  const prev = lastMonthRangeAlmaty();
  const week = thisWeekRangeAlmaty();
  const dayOfMonth = nowInAlmaty().day;
  const since = new Date(Date.now() - 120 * 86400000).toISOString();

  const empty = {
    monthLabel: month.label,
    prevLabel: prev.label,
    dayOfMonth,
    days,
    teamSeries: days.map(() => 0),
    people: [],
    total: 0,
    prevSame: 0,
    prevFull: 0,
    today: 0,
    week: 0,
    pending: 0,
    quiet: [],
  };
  if (ids.length === 0) return empty;

  const [{ data: approved }, { data: pending }] = await Promise.all([
    admin
      .from("revenue_requests")
      .select("user_id, amount_kzt, earned_at, created_at")
      .eq("status", "approved")
      .in("user_id", ids)
      .gte("created_at", since),
    admin
      .from("revenue_requests")
      .select("user_id")
      .eq("status", "pending")
      .in("user_id", ids),
  ]);

  const dayIndex = Object.fromEntries(days.map((d, i) => [d.key, i]));
  const byUser = Object.fromEntries(
    ids.map((id) => [
      id,
      { month: 0, deals: 0, week: 0, today: 0, series: days.map(() => 0), last: null },
    ])
  );
  const teamSeries = days.map(() => 0);
  let prevSame = 0;
  let prevFull = 0;
  let total = 0;
  let todayTotal = 0;
  let weekTotal = 0;

  const monthStart = Date.parse(month.start);
  const monthEnd = Date.parse(month.end);
  const prevStart = Date.parse(prev.start);
  const prevEnd = Date.parse(prev.end);
  const weekStart = Date.parse(week.start);
  const weekEnd = Date.parse(week.end);
  // Прошлый месяц «за те же дни»: с 1-го до сегодняшнего числа включительно.
  const prevSameEnd = Math.min(prevEnd, prevStart + dayOfMonth * 86400000);

  for (const r of approved ?? []) {
    const at = r.earned_at ?? r.created_at;
    const t = Date.parse(at);
    const sum = num(r.amount_kzt);
    const u = byUser[r.user_id];
    if (!u) continue;
    if (!u.last || at > u.last) u.last = at;
    if (t >= monthStart && t < monthEnd) {
      u.month += sum;
      u.deals += 1;
      total += sum;
    }
    if (t >= prevStart && t < prevEnd) {
      prevFull += sum;
      if (t < prevSameEnd) prevSame += sum;
    }
    if (t >= weekStart && t < weekEnd) {
      u.week += sum;
      weekTotal += sum;
    }
    const key = almatyDayKey(at);
    const i = dayIndex[key];
    if (i != null) {
      u.series[i] += sum;
      teamSeries[i] += sum;
      if (key === todayKey) {
        u.today += sum;
        todayTotal += sum;
      }
    }
  }

  const pendingCount = {};
  for (const r of pending ?? []) pendingCount[r.user_id] = (pendingCount[r.user_id] ?? 0) + 1;

  const list = people.map((m) => {
    const u = byUser[m.id];
    return {
      id: m.id,
      name: m.name,
      role: m.role,
      month_kzt: u.month,
      month_deals: u.deals,
      week_kzt: u.week,
      today_kzt: u.today,
      series: u.series,
      // «Сейчас» считаем на сервере: в браузере оно другое, и React
      // ругался бы на расхождение разметки.
      days_since_paid: u.last
        ? Math.max(0, Math.floor((Date.now() - Date.parse(u.last)) / 86400000))
        : null,
      pending: pendingCount[m.id] ?? 0,
    };
  });

  const quiet = list
    .filter((m) => m.role !== "trainee" && (m.days_since_paid == null || m.days_since_paid >= QUIET_DAYS))
    .map((m) => ({ id: m.id, name: m.name, days: m.days_since_paid }));

  return {
    ...empty,
    teamSeries,
    people: list,
    total,
    prevSame,
    prevFull,
    today: todayTotal,
    week: weekTotal,
    pending: (pending ?? []).length,
    quiet,
  };
}
