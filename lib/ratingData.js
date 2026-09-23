import { createClient } from "@/lib/supabase-server";
import { thisWeekRangeAlmaty } from "@/lib/timezone";

// Данные рейтинга готовим на сервере: и список людей, и итоги текущей
// недели. Один и тот же рейтинг показывается менеджеру, наблюдателю и
// админу — чтобы он не расходился, собираем его здесь, в одном месте.
export async function getRatingData() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const week = thisWeekRangeAlmaty();

  // Без фильтра is_active: уволенный, но реально заработавший в прошлом
  // сотрудник должен оставаться виден в истории рейтинга — под своим именем.
  const [{ data: users }, { data: weekRows }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, total_earned, is_active")
      .eq("role", "mop")
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local"),
    supabase.rpc("rating_totals", { p_start: week.start, p_end: week.end }),
  ]);

  const initialTotals = {};
  for (const row of weekRows ?? []) {
    initialTotals[row.user_id] = (initialTotals[row.user_id] ?? 0) + row.total;
  }

  return {
    currentUserId: user?.id ?? null,
    users: users ?? [],
    initialTotals,
  };
}
