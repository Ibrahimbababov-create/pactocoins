import { getTournamentPage } from "@/lib/tournamentView";
import { sweepTournaments } from "@/lib/tournament";

// Данные для живого экрана «Наблюдать за игрой» (телевизор в офисе и
// телефоны). Тот же расклад, что на странице турнира, но без личного:
// без заметок из споров и без «моих матчей».
const MATCH_FIELDS = [
  "id",
  "round",
  "slot",
  "tour",
  "player_a",
  "player_b",
  "status",
  "winner_id",
  "method",
  "reported_by",
  "reported_at",
  "confirm_by",
  "decided_by",
  "decided_at",
  "ready_at",
  "play_by",
  "next_match_id",
];

const pick = (row, keys) => Object.fromEntries(keys.map((k) => [k, row[k] ?? null]));

export async function getLiveData(admin, tid, viewer) {
  let data = await getTournamentPage(admin, tid, viewer);
  if (!data) return null;

  // Срок подтверждения вышел — засчитываем сразу, чтобы экран не ждал,
  // пока кто-нибудь откроет страницу турнира.
  const now = new Date().toISOString();
  if (data.matches.some((m) => m.status === "reported" && m.confirm_by && m.confirm_by < now)) {
    await sweepTournaments(admin, { tournamentId: tid });
    data = await getTournamentPage(admin, tid, viewer);
    if (!data) return null;
  }

  const t = data.tournament;
  return {
    tournament: pick(t, [
      "id",
      "title",
      "status",
      "format",
      "pot",
      "entry_fee",
      "bonus_coins",
      "playoff_size",
      "playoff_wins",
      "league_ends_at",
      "registration_ends_at",
      "clan_tag",
      "winner_id",
      "started_at",
      "finished_at",
      "max_players",
    ]),
    people: Object.fromEntries(Object.entries(data.people).map(([id, p]) => [id, { name: p.name }])),
    entries: data.entries.map((e) => ({ userId: e.userId, status: e.status, joinedAt: e.joinedAt })),
    matches: data.matches.filter((m) => m.status !== "void").map((m) => pick(m, MATCH_FIELDS)),
    rounds: data.rounds,
    stage: data.stage,
    serverNow: Date.now(),
  };
}
