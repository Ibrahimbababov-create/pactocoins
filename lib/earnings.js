import { monthRangeAlmaty, currentMonthKeyAlmaty } from "@/lib/timezone";

// "Заработано" = сумма положительных транзакций, кроме возвратов за
// отменённые покупки (та же логика, что держит колонку users.total_earned
// в базе — см. миграцию block_a2). Раньше "за месяц" дублировалось в
// отдельной колонке month_earned, которая никогда не обнулялась и потому
// всегда совпадала с total_earned. Теперь считаем на лету агрегатом в БД.
export async function getEarnedMap(supabase, userIds, { start, end } = {}) {
  const ids = (userIds ?? []).filter(Boolean);
  if (!ids.length) return {};

  const { data, error } = await supabase.rpc("earned_in_range", {
    p_user_ids: ids,
    p_start: start ?? null,
    p_end: end ?? null,
  });

  if (error) {
    console.error("[getEarnedMap]", error);
    return {};
  }

  const map = {};
  for (const row of data ?? []) map[row.user_id] = row.total;
  return map;
}

export async function getMonthEarnedMap(supabase, userIds) {
  const { start, end } = monthRangeAlmaty(currentMonthKeyAlmaty());
  return getEarnedMap(supabase, userIds, { start, end });
}

export async function getMonthEarned(supabase, userId) {
  const map = await getMonthEarnedMap(supabase, [userId]);
  return map[userId] ?? 0;
}
