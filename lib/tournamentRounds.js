// Крутки на колесе фортуны за места в турнире, сверху банка: 1-е, 2-е,
// 3–4-е (решение Ибрагима, октябрь 2026). Здесь, а не в lib/tournament.js:
// число показывает и экран колеса в браузере.
export const PLACE_SPINS = [5, 3, 1];

// Название раунда от конца сетки. Отдельно от lib/tournamentBracket.js:
// там серверный crypto, а это нужно и в браузере.
export function roundLabel(round, rounds) {
  if (round === 0) return "Лига";
  const left = rounds - round;
  if (left === 0) return "Финал";
  if (left === 1) return "Полуфинал";
  if (left === 2) return "1/4 финала";
  return `1/${2 ** left} финала`;
}

// Серия: сколько побед нужно, чтобы взять матч. Лига (round 0) всегда в
// один бой, плей-офф до tournaments.playoff_wins побед.
export const winsNeeded = (t, m) => (m?.round > 0 ? Math.max(1, Number(t?.playoff_wins) || 1) : 1);

// Сколько боёв серии уже засчитано.
export const battlesPlayed = (m) => (m?.wins_a ?? 0) + (m?.wins_b ?? 0);

// Длина журнала боёв. Кнопка отправляет её вместе с итогом: второй тап по
// тому же бою придёт со старым номером и не засчитается.
export const battleSeq = (m) => (Array.isArray(m?.battles) ? m.battles.length : 0);

// Счёт серии со стороны игрока (m — матч или ответ SQL-функции с player_a).
export function scoreFor(m, userId) {
  const a = m?.wins_a ?? 0;
  const b = m?.wins_b ?? 0;
  return userId === m?.player_a ? { mine: a, theirs: b } : { mine: b, theirs: a };
}

// Таблица лиги по сыгранным матчам (round 0): победы, потом меньше
// поражений, потом личная встреча, потом порядок записи.
export function leagueStandings(playerIds, matches) {
  const rows = new Map(playerIds.map((id, i) => [id, { userId: id, played: 0, wins: 0, losses: 0, order: i }]));
  const done = matches.filter((m) => m.round === 0 && m.status === "done" && m.winner_id);
  for (const m of done) {
    const loser = m.winner_id === m.player_a ? m.player_b : m.player_a;
    const w = rows.get(m.winner_id);
    const l = rows.get(loser);
    if (w) {
      w.played++;
      w.wins++;
    }
    if (l) {
      l.played++;
      l.losses++;
    }
  }
  const headToHead = (x, y) => {
    const m = done.find(
      (g) => (g.player_a === x && g.player_b === y) || (g.player_a === y && g.player_b === x)
    );
    if (!m) return 0;
    return m.winner_id === x ? -1 : 1;
  };
  const list = [...rows.values()].sort(
    (x, y) => y.wins - x.wins || x.losses - y.losses || headToHead(x.userId, y.userId) || x.order - y.order
  );
  list.forEach((r, i) => (r.place = i + 1));
  return list;
}
