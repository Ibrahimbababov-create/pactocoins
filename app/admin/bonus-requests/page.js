import { createClient } from "@/lib/supabase-server";
import BonusRequestsClient from "@/components/BonusRequestsClient";
import {
  lastWeekRangeAlmaty,
  lastMonthRangeAlmaty,
  thisWeekRangeAlmaty,
  monthRangeAlmaty,
  currentMonthKeyAlmaty,
} from "@/lib/timezone";

// Топ-3 считаем по той же выручке в тенге, что и рейтинг: призы выдаются
// за места в нём, поэтому списки обязаны совпадать. Раньше здесь
// складывались коины — после перевода рейтинга на выручку порог в тенге
// сравнивался с коинами, и выходило «порог никто не прошёл».
async function rankingFor(supabase, empIds, nameById, start, end) {
  if (!empIds.length) return [];
  const allowed = new Set(empIds);

  const { data: rows } = await supabase.rpc("rating_revenue", {
    p_start: start,
    p_end: end,
  });

  return (rows ?? [])
    .filter((r) => allowed.has(r.user_id) && Number(r.total) > 0)
    .map((r) => ({
      id: r.user_id,
      name: nameById[r.user_id] ?? "—",
      total: Number(r.total),
    }))
    .sort((a, b) => b.total - a.total);
}

export default async function BonusRequestsPage() {
  const supabase = createClient();
  const lastWeek = lastWeekRangeAlmaty();
  const thisWeek = thisWeekRangeAlmaty();
  const lastMonth = lastMonthRangeAlmaty();
  const thisMonth = monthRangeAlmaty(currentMonthKeyAlmaty());

  const withUser = "*, users!bonus_requests_user_id_fkey(name, email, is_guest)";
  const HISTORY_PAGE = 20;

  // Ожидающие целиком, история — порциями по 20.
  const [{ data: pendingReq }, { data: historyReq }, { count: historyCount }] =
    await Promise.all([
      supabase
        .from("bonus_requests")
        .select(withUser)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("bonus_requests")
        .select(withUser)
        .neq("status", "pending")
        .order("created_at", { ascending: false })
        .range(0, HISTORY_PAGE - 1),
      supabase
        .from("bonus_requests")
        .select("*", { count: "exact", head: true })
        .neq("status", "pending"),
    ]);

  const requests = [...(pendingReq ?? []), ...(historyReq ?? [])];

  const { data: employees } = await supabase
    .from("users")
    .select("id, name, role, rop_id")
    .in("role", ["mop", "rop"])
    .eq("is_active", true)
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local")
    .order("name");

  // Отдельно — без is_active, только для истории топ-3: уволенный, но
  // реально заработавший в том периоде сотрудник должен остаться виден по
  // имени. В пикер начисления (`employees` выше) уволенные не попадают.
  const { data: historyEmployees } = await supabase
    .from("users")
    .select("id, name")
    .in("role", ["mop", "observer"])
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local");

  const empIds = (historyEmployees ?? []).map((e) => e.id);
  const nameById = Object.fromEntries(
    (historyEmployees ?? []).map((e) => [e.id, e.name])
  );

  const [lastWeekRanking, thisWeekRanking, lastMonthRanking, thisMonthRanking] =
    await Promise.all([
      rankingFor(supabase, empIds, nameById, lastWeek.start, lastWeek.end),
      rankingFor(supabase, empIds, nameById, thisWeek.start, thisWeek.end),
      rankingFor(supabase, empIds, nameById, lastMonth.start, lastMonth.end),
      rankingFor(supabase, empIds, nameById, thisMonth.start, thisMonth.end),
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Бонусы</h1>
      <BonusRequestsClient
        requests={requests}
        historyTotal={historyCount ?? 0}
        historyPageSize={HISTORY_PAGE}
        employees={employees ?? []}
        weekVariants={[
          {
            key: "last",
            tab: "Прошлая",
            phrase: "за прошлую неделю",
            periodLabel: lastWeek.label,
            ranking: lastWeekRanking,
          },
          {
            key: "this",
            tab: "Текущая",
            phrase: "за неделю",
            periodLabel: thisWeek.label,
            ranking: thisWeekRanking,
          },
        ]}
        monthVariants={[
          {
            key: "last",
            tab: "Прошлый",
            phrase: "за прошлый месяц",
            periodLabel: lastMonth.label,
            ranking: lastMonthRanking,
          },
          {
            key: "this",
            tab: "Текущий",
            phrase: "за месяц",
            periodLabel: thisMonth.label,
            ranking: thisMonthRanking,
          },
        ]}
      />
    </div>
  );
}
