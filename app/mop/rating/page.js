import { createClient } from "@/lib/supabase-server";
import RatingClient from "@/components/RatingClient";
import { thisWeekRangeAlmaty } from "@/lib/timezone";

export default async function RatingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const week = thisWeekRangeAlmaty();

  // Без фильтра is_active: уволенный, но реально заработавший в прошлом
  // сотрудник должен оставаться виден в истории рейтинга — под своим именем.
  // Итоги за текущую неделю считаем здесь же: страница и так рендерится на
  // сервере рядом с базой, а из браузера тот же запрос занимал секунды и
  // экран стоял пустым (см. редизайн 23.09).
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display font-bold">Рейтинг</h1>
      <RatingClient
        currentUserId={user.id}
        users={users ?? []}
        initialTotals={initialTotals}
      />
    </div>
  );
}
