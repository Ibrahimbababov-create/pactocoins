import { randomInt, randomUUID } from "crypto";

// Олимпийская сетка (проиграл — вылетел). Чистая логика, без базы.
//
// Размер сетки — ближайшая степень двойки. Лишние места — «проходит без
// игры»: они достаются случайно выбранным игрокам и никогда не встречаются
// друг с другом. Посев — стандартный порядок (1–8, 4–5, 2–7, 3–6), игроки
// перемешаны случайно.

function seedOrder(size) {
  let order = [1];
  while (order.length < size) {
    const m = order.length * 2 + 1;
    order = order.flatMap((s) => [s, m - s]);
  }
  return order;
}

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export { roundLabel } from "@/lib/tournamentRounds";

// playerIds → { rounds, seeds: { userId: seed }, matches: [...] } — строки
// для tournament_matches. Матчи с «пустым» соперником уже завершены (bye),
// их победитель стоит в следующем матче; если там оба известны — матч ready.
export function buildBracket(playerIds, { roundHours = 24, now = new Date() } = {}) {
  const n = playerIds.length;
  if (n < 2) throw new Error("Нужно хотя бы 2 участника");
  if (n > 64) throw new Error("Не больше 64 участников");

  const size = 2 ** Math.ceil(Math.log2(n));
  const rounds = Math.log2(size);
  const players = shuffle(playerIds);
  const seeds = Object.fromEntries(players.map((id, i) => [id, i + 1]));
  const bySeed = (s) => (s <= n ? players[s - 1] : null);

  // Все матчи сразу: round 1..rounds, slot 0..
  const grid = [];
  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    grid[r] = Array.from({ length: count }, (_, slot) => ({
      id: randomUUID(),
      round: r,
      slot,
      player_a: null,
      player_b: null,
      status: "waiting",
      winner_id: null,
      method: null,
      next_match_id: null,
      next_slot: null,
    }));
  }
  for (let r = 1; r < rounds; r++) {
    grid[r].forEach((m, slot) => {
      m.next_match_id = grid[r + 1][Math.floor(slot / 2)].id;
      m.next_slot = slot % 2 ? "b" : "a";
    });
  }

  const order = seedOrder(size);
  grid[1].forEach((m, k) => {
    m.player_a = bySeed(order[2 * k]);
    m.player_b = bySeed(order[2 * k + 1]);
  });

  const byId = new Map(grid.flat().filter(Boolean).map((m) => [m.id, m]));
  const playBy = new Date(now.getTime() + roundHours * 3600000).toISOString();
  const nowIso = now.toISOString();

  // Без соперника — сразу проходит дальше.
  for (const m of grid[1]) {
    const alone = m.player_a && !m.player_b ? m.player_a : !m.player_a && m.player_b ? m.player_b : null;
    if (!alone) continue;
    m.status = "done";
    m.method = "bye";
    m.winner_id = alone;
    const next = byId.get(m.next_match_id);
    if (next) next[m.next_slot === "a" ? "player_a" : "player_b"] = alone;
  }

  for (const m of byId.values()) {
    if (m.status === "waiting" && m.player_a && m.player_b) {
      m.status = "ready";
      m.ready_at = nowIso;
      m.play_by = playBy;
    }
  }

  return { rounds, size, seeds, matches: [...byId.values()] };
}
