import {
  thisWeekRangeAlmaty,
  monthRangeAlmaty,
  currentMonthKeyAlmaty,
} from "@/lib/timezone";
import { WEEKLY_TOP } from "@/lib/topBonusConfig";

// Короткие выжимки для главного экрана: «где я в рейтинге» и «как идёт моя
// команда». Считаются теми же правилами, что экран рейтинга
// (lib/ratingData.js): выручка в тенге по подтверждённым оплатам, без гостя
// и тестовых аккаунтов.

// Место в рейтинге текущей недели. null — человек в рейтинге не участвует
// (админ, РОП, стажёр, гость): карточку тогда не показываем.
export async function getMyWeekPlace(supabase, userId) {
  const week = thisWeekRangeAlmaty();
  const [{ data: users }, { data: rows }] = await Promise.all([
    supabase
      .from("users")
      .select("id")
      .in("role", ["mop", "observer"])
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local"),
    supabase.rpc("rating_revenue", { p_start: week.start, p_end: week.end }),
  ]);

  const ids = new Set((users ?? []).map((u) => u.id));
  if (!ids.has(userId)) return null;

  const totals = (rows ?? [])
    .filter((r) => ids.has(r.user_id))
    .map((r) => ({ id: r.user_id, value: Number(r.total) || 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const mine = totals.find((r) => r.id === userId)?.value ?? 0;
  const prizeMin = WEEKLY_TOP.min;

  if (mine === 0) {
    return { place: null, ranked: totals.length, value: 0, prizeMin };
  }

  // Делим место с теми, у кого ровно столько же.
  const place = totals.filter((r) => r.value > mine).length + 1;
  const above = totals.filter((r) => r.value > mine).at(-1)?.value ?? null;
  const below = totals.find((r) => r.value < mine)?.value ?? null;
  const prize =
    mine >= prizeMin && place <= WEEKLY_TOP.prizes.length
      ? WEEKLY_TOP.prizes[place - 1]
      : null;

  return {
    place,
    ranked: totals.length,
    value: mine,
    gapUp: above != null ? above - mine : null,
    leadOver: place === 1 && below != null ? mine - below : null,
    prizeMin,
    prize,
  };
}

// Команда РОПа за текущий месяц: общая выручка, кто с оплатами, лучший.
export async function getMyTeamMonth(supabase, ropId) {
  const range = monthRangeAlmaty(currentMonthKeyAlmaty());
  const [{ data: team }, { data: rows }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name")
      .eq("rop_id", ropId)
      .eq("is_active", true)
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local"),
    supabase.rpc("rating_revenue", { p_start: range.start, p_end: range.end }),
  ]);

  const members = team ?? [];
  const byId = Object.fromEntries(
    (rows ?? []).map((r) => [r.user_id, Number(r.total) || 0])
  );
  const withValue = members
    .map((m) => ({ name: m.name, value: byId[m.id] ?? 0 }))
    .sort((a, b) => b.value - a.value);

  return {
    monthLabel: range.label,
    size: members.length,
    total: withValue.reduce((s, m) => s + m.value, 0),
    withPayments: withValue.filter((m) => m.value > 0).length,
    best: withValue[0]?.value > 0 ? withValue[0] : null,
  };
}
