import { roundsOf } from "@/lib/tournament";

// Данные турниров для экранов (читаем сервисным клиентом: имена коллег и
// чужие матчи нужны всем участникам).

const VISIBLE = ["registration", "running", "finished", "cancelled"];

// Тестовые турниры и черновики видят только админы и участники.
function canSee(t, viewer, isEntrant) {
  if (viewer?.role === "admin") return true;
  if (isEntrant) return true;
  return VISIBLE.includes(t.status) && !t.is_test;
}

// Турнир для карточки в «Играх»: идёт запись или сам турнир; завершённый
// показываем ещё 3 дня, чтобы все увидели победителя.
export async function getFeaturedTournament(admin, viewer) {
  const since = new Date(Date.now() - 3 * 86400000).toISOString();
  const { data: list } = await admin
    .from("tournaments")
    .select("*")
    .in("status", ["registration", "seeding", "running", "finished"])
    .order("created_at", { ascending: false })
    .limit(10);
  const candidates = (list ?? []).filter((t) => t.status !== "finished" || (t.finished_at ?? "") >= since);
  if (!candidates.length) return null;

  const ids = candidates.map((t) => t.id);
  const { data: entries } = await admin
    .from("tournament_entries")
    .select("tournament_id, user_id, paid_coins, status")
    .in("tournament_id", ids)
    .neq("status", "refunded");

  for (const t of candidates) {
    const mine = (entries ?? []).some((e) => e.tournament_id === t.id && e.user_id === viewer?.id);
    if (!canSee(t, viewer, mine)) continue;
    const own = (entries ?? []).filter((e) => e.tournament_id === t.id);
    const pot = t.pot_coins ?? own.reduce((s, e) => s + (e.paid_coins || 0), 0) + (t.bonus_coins || 0);
    let winnerName = null;
    if (t.winner_id) {
      const { data: w } = await admin.from("users").select("name").eq("id", t.winner_id).maybeSingle();
      winnerName = w?.name ?? null;
    }
    let myMatch = null;
    if (mine && t.status === "running") {
      const { data: ms } = await admin
        .from("tournament_matches")
        .select("id, status, player_a, player_b, reported_by")
        .eq("tournament_id", t.id)
        .or(`player_a.eq.${viewer.id},player_b.eq.${viewer.id}`)
        .in("status", ["ready", "reported", "disputed"]);
      myMatch = ms?.[0] ?? null;
    }
    return { ...t, pot, players: own.length, joined: mine, winnerName, myMatch };
  }
  return null;
}

// Всё для страницы турнира.
export async function getTournamentPage(admin, tid, viewer) {
  const { data: t } = await admin.from("tournaments").select("*").eq("id", tid).maybeSingle();
  if (!t) return null;

  const [{ data: entries }, { data: matches }] = await Promise.all([
    admin
      .from("tournament_entries")
      .select("user_id, paid_coins, clash_tag, seed, status, joined_at")
      .eq("tournament_id", tid)
      .order("joined_at"),
    admin.from("tournament_matches").select("*").eq("tournament_id", tid).order("round").order("slot"),
  ]);

  const active = (entries ?? []).filter((e) => e.status !== "refunded");
  const mineEntry = active.find((e) => e.user_id === viewer?.id) ?? null;
  if (!canSee(t, viewer, Boolean(mineEntry))) return null;

  const ids = [
    ...active.map((e) => e.user_id),
    ...(matches ?? []).flatMap((m) => [m.player_a, m.player_b]),
    t.winner_id,
  ].filter(Boolean);
  const { data: users } = ids.length
    ? await admin.from("users").select("id, name, clash_tag").in("id", [...new Set(ids)])
    : { data: [] };
  const people = Object.fromEntries((users ?? []).map((u) => [u.id, { name: u.name, tag: u.clash_tag }]));

  const pot = t.pot_coins ?? active.reduce((s, e) => s + (e.paid_coins || 0), 0) + (t.bonus_coins || 0);
  const list = matches ?? [];
  const myMatch =
    list.find(
      (m) =>
        (m.player_a === viewer?.id || m.player_b === viewer?.id) &&
        ["ready", "reported", "disputed", "waiting"].includes(m.status)
    ) ?? null;

  return {
    tournament: { ...t, pot },
    people,
    entries: active.map((e) => ({ userId: e.user_id, seed: e.seed, status: e.status })),
    matches: list,
    rounds: list.length ? roundsOf(list) : 0,
    me: mineEntry ? { status: mineEntry.status } : null,
    myMatch,
  };
}
