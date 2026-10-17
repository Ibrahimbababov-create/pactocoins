import { buildBracket, buildLeague } from "@/lib/tournamentBracket";
import { addSpins } from "@/lib/addSpins";
import { leagueStandings, PLACE_SPINS } from "@/lib/tournamentRounds";
import {
  notifyMatchReady,
  notifyReported,
  notifyDispute,
  notifyFinished,
  announceStart,
  notifyLeagueStart,
  notifyLeagueDone,
  announcePlayoff,
  notifyOutOfPlayoff,
} from "@/lib/tournamentNotify";

// Логика турнира — одна для приложения, бота и крона, чтобы они не
// разъехались (как это бывает с одобрением заявок). Коины и продвижение по
// сетке двигают только SQL-функции tournament_* (supabase/tournaments.sql):
// они блокируют строку и «захватывают» матч, поэтому двойной тап,
// параллельный бот и крон не заплатят и не продвинут дважды.

export const TOURNAMENT_ERRORS = {
  not_found: "Турнир не найден",
  closed: "Запись закрыта",
  not_allowed: "В этом турнире ты участвовать не можешь",
  no_tag: "Сначала укажи тег Clash Royale",
  already: "Уже сделано",
  full: "Мест больше нет",
  insufficient: "Не хватает коинов на взнос",
  started: "Турнир уже начался, выйти нельзя",
  not_joined: "Ты не записан",
};
export const tournamentError = (code) => TOURNAMENT_ERRORS[code] ?? "Не получилось, попробуй ещё раз";

// Ночью на подтверждение не давим: срок, выпавший на 23:00–09:00 Алматы,
// переносим на 10:00 (Алматы = UTC+5 круглый год).
export function confirmDeadline(hours, now = new Date()) {
  const d = new Date(now.getTime() + hours * 3600000);
  const h = (d.getUTCHours() + 5) % 24;
  if (h >= 23 || h < 9) {
    const local = new Date(d.getTime() + 5 * 3600000);
    if (h >= 23) local.setUTCDate(local.getUTCDate() + 1);
    local.setUTCHours(10, 0, 0, 0);
    return new Date(local.getTime() - 5 * 3600000);
  }
  return d;
}

// Раундов плей-офф (матчи лиги — round 0 — не считаются).
export const roundsOf = (matches) => Math.max(0, ...matches.filter((m) => m.round > 0).map((m) => m.round));

// Имена и теги участников: { userId: { name, clash_tag } }.
export async function playerNames(admin, ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return {};
  const { data } = await admin.from("users").select("id, name, clash_tag").in("id", list);
  return Object.fromEntries((data ?? []).map((u) => [u.id, u]));
}

async function loadMatch(admin, matchId) {
  const { data: m } = await admin.from("tournament_matches").select("*").eq("id", matchId).maybeSingle();
  if (!m) return {};
  const { data: t } = await admin.from("tournaments").select("*").eq("id", m.tournament_id).single();
  return { m, t };
}

async function allMatches(admin, tid) {
  const { data } = await admin.from("tournament_matches").select("*").eq("tournament_id", tid);
  return data ?? [];
}

// После завершения матча: сообщения и, если следующий матч готов, — обоим
// его игрокам.
async function afterFinish(admin, t, res, method = null) {
  if (!res?.ok) return;
  const matches = await allMatches(admin, t.id);
  if (res.league) {
    const names = await playerNames(admin, [res.winner, res.loser]);
    await notifyFinished(admin, t, res, names, method);
    const open = matches.some((m) => m.round === 0 && ["ready", "reported", "disputed"].includes(m.status));
    if (!open) {
      // Лига сыграна целиком — сразу плей-офф, всё в тот же вечер. Запуск
      // захватывает турнир, так что два последних матча одновременно
      // второй раз ничего не запустят. Не вышло — пишем админам, как раньше.
      const po = await startPlayoff(admin, t.id);
      if (po?.error && !/уже идёт|только во время лиги/.test(po.error)) await notifyLeagueDone(admin, t);
    }
    return;
  }
  const next = res.next_match ? matches.find((x) => x.id === res.next_match) : null;
  const prizes = res.final ? podium(matches, res) : null;
  if (prizes) {
    // Финал засчитывается один раз (захват матча в базе), поэтому и крутки
    // выдаются один раз.
    for (const [id, n] of prizes.awards) await addSpins(admin, id, n);
  }
  const names = await playerNames(admin, [
    res.winner,
    res.loser,
    next?.player_a,
    next?.player_b,
    ...(prizes?.third ?? []),
  ]);
  const fresh = res.final ? { ...t, status: "finished" } : t;
  await notifyFinished(admin, fresh, res, names, method, prizes);
  if (next && res.next_ready && next.status === "ready") {
    await notifyMatchReady(admin, t, next, names, roundsOf(matches));
  }
}

// Кто занял места: финал даёт 1-е и 2-е, проигравшие в полуфиналах делят 3-е.
function podium(matches, res) {
  const rounds = roundsOf(matches);
  const third =
    rounds >= 2
      ? matches
          .filter((m) => m.round === rounds - 1 && m.status === "done" && m.winner_id && m.method !== "bye")
          .map((m) => (m.winner_id === m.player_a ? m.player_b : m.player_a))
          .filter(Boolean)
      : [];
  const awards = [
    [res.winner, PLACE_SPINS[0]],
    [res.loser, PLACE_SPINS[1]],
    ...third.map((id) => [id, PLACE_SPINS[2]]),
  ].filter(([id]) => id);
  return { first: res.winner, second: res.loser, third, awards };
}

async function finish(admin, matchId, winnerId, method, actorId, from) {
  const { data: res, error } = await admin.rpc("tournament_finish_match", {
    p_match: matchId,
    p_winner: winnerId,
    p_method: method,
    p_actor: actorId ?? null,
    p_from: from,
  });
  if (error) return { error: error.message };
  return res;
}

// Старт: захватываем «регистрация → посев», строим сетку, вставляем матчи,
// «посев → идёт». Запись в турнир держит ту же строку и проверяет статус,
// так что никто не впрыгнет в уже собранную сетку.
export async function startTournament(admin, tid) {
  const { data: claimed } = await admin
    .from("tournaments")
    .update({ status: "seeding" })
    .eq("id", tid)
    .eq("status", "registration")
    .select("*");
  const t = claimed?.[0];
  if (!t) return { error: "Турнир уже запущен или ещё не открыт" };

  const revert = async (error) => {
    await admin.from("tournaments").update({ status: "registration" }).eq("id", tid).eq("status", "seeding");
    return { error };
  };

  const { data: entries } = await admin
    .from("tournament_entries")
    .select("user_id, paid_coins")
    .eq("tournament_id", tid)
    .eq("status", "active");
  const players = (entries ?? []).map((e) => e.user_id);
  if (players.length < Math.max(2, t.min_players)) {
    return revert(`Мало участников: ${players.length}, нужно хотя бы ${Math.max(2, t.min_players)}`);
  }

  const isLeague = t.format === "league";
  let rows;
  let rounds = 0;
  let seeds = {};
  try {
    if (isLeague) {
      const endsAt = t.league_ends_at && new Date(t.league_ends_at) > new Date()
        ? t.league_ends_at
        : new Date(Date.now() + t.round_hours * 3600000).toISOString();
      if (endsAt !== t.league_ends_at) {
        await admin.from("tournaments").update({ league_ends_at: endsAt }).eq("id", tid);
        t.league_ends_at = endsAt;
      }
      rows = buildLeague(players, { endsAt });
      players.forEach((id, i) => (seeds[id] = i + 1));
    } else {
      const bracket = buildBracket(players, { roundHours: t.round_hours });
      rows = bracket.matches;
      rounds = bracket.rounds;
      seeds = bracket.seeds;
    }
  } catch (err) {
    return revert(String(err.message || err));
  }

  // У всех строк одинаковый набор полей — так вставка пачкой надёжнее.
  rows = rows.map((m) => ({ ready_at: null, play_by: null, tour: null, ...m, tournament_id: tid }));
  const { error: insErr } = await admin.from("tournament_matches").insert(rows);
  if (insErr) return revert(insErr.message);

  await Promise.all(
    Object.entries(seeds).map(([userId, seed]) =>
      admin.from("tournament_entries").update({ seed }).eq("tournament_id", tid).eq("user_id", userId)
    )
  );

  const pot = (entries ?? []).reduce((s, e) => s + (e.paid_coins || 0), 0) + (t.bonus_coins || 0);
  const { data: started } = await admin
    .from("tournaments")
    .update({ status: "running", started_at: new Date().toISOString(), pot_coins: pot })
    .eq("id", tid)
    .eq("status", "seeding")
    .select("*");
  const running = started?.[0] ?? { ...t, pot_coins: pot };

  const names = await playerNames(admin, players);
  if (isLeague) {
    await notifyLeagueStart(admin, running, rows, names);
  } else {
    await announceStart(running, rows, names, rounds);
    for (const m of rows.filter((x) => x.status === "ready")) {
      await notifyMatchReady(admin, running, m, names, rounds);
    }
  }
  return { ok: true, players: players.length, rounds };
}

// Лига → плей-офф: несыгранные матчи лиги отменяются, лучшие playoff_size
// по таблице выходят в сетку (1-й с последним), остальные выбывают.
export async function startPlayoff(admin, tid) {
  const { data: claimed } = await admin
    .from("tournaments")
    .update({ status: "seeding" })
    .eq("id", tid)
    .eq("status", "running")
    .eq("format", "league")
    .select("*");
  const t = claimed?.[0];
  if (!t) return { error: "Плей-офф можно запустить только во время лиги" };
  const back = async (error) => {
    await admin.from("tournaments").update({ status: "running" }).eq("id", tid).eq("status", "seeding");
    return { error };
  };

  const matches = await allMatches(admin, tid);
  if (matches.some((m) => m.round > 0)) return back("Плей-офф уже идёт");

  const { data: entries } = await admin
    .from("tournament_entries")
    .select("user_id, joined_at")
    .eq("tournament_id", tid)
    .eq("status", "active")
    .order("joined_at");
  const players = (entries ?? []).map((e) => e.user_id);
  const size = Math.min(t.playoff_size ?? 4, players.length);
  if (size < 2) return back("Для плей-офф нужно хотя бы 2 игрока");

  const table = leagueStandings(players, matches);
  const top = table.slice(0, size);
  let bracket;
  try {
    bracket = buildBracket(
      top.map((r) => r.userId),
      { roundHours: t.round_hours, seeded: true }
    );
  } catch (err) {
    return back(String(err.message || err));
  }

  const rows = bracket.matches.map((m) => ({ ready_at: null, play_by: null, tour: null, ...m, tournament_id: tid }));
  const { error: insErr } = await admin.from("tournament_matches").insert(rows);
  if (insErr) return back(insErr.message);

  // Только после того как сетка встала: несыгранные матчи лиги больше не в счёт.
  await admin
    .from("tournament_matches")
    .update({ status: "void" })
    .eq("tournament_id", tid)
    .eq("round", 0)
    .in("status", ["waiting", "ready", "reported", "disputed"]);

  const out = table.slice(size).map((r) => r.userId);
  if (out.length) {
    await admin
      .from("tournament_entries")
      .update({ status: "eliminated" })
      .eq("tournament_id", tid)
      .in("user_id", out)
      .eq("status", "active");
  }
  await admin.from("tournaments").update({ status: "running" }).eq("id", tid).eq("status", "seeding");

  const names = await playerNames(admin, players);
  await announcePlayoff(t, top, names, rows, bracket.rounds);
  for (const m of rows.filter((x) => x.status === "ready")) {
    await notifyMatchReady(admin, t, m, names, bracket.rounds);
  }
  await notifyOutOfPlayoff(admin, t, out);
  return { ok: true, playoff: size };
}

// Игрок сообщает итог. «Победа соперника» — сразу финал матча. «Моя
// победа» — ждём подтверждения соперника (или срок confirm_hours).
export async function reportResult(admin, matchId, userId, outcome) {
  const { m, t } = await loadMatch(admin, matchId);
  if (!m || !t) return { error: "Матч не найден" };
  if (t.status !== "running") return { error: "Турнир не идёт" };
  if (userId !== m.player_a && userId !== m.player_b) return { error: "Это не твой матч" };
  const opponent = userId === m.player_a ? m.player_b : m.player_a;

  if (outcome === "lost") {
    const res = await finish(admin, m.id, opponent, "loser_report", userId, ["ready", "reported"]);
    if (res?.error) return { error: res.error === "already" ? "Итог этого матча уже записан" : res.error };
    await afterFinish(admin, t, res, "loser_report");
    return { ok: true, final: true };
  }

  if (m.status === "reported") {
    if (m.reported_by === userId) return { error: "Уже отправлено, ждём соперника" };
    // Оба считают, что победили, — спор, решает админ.
    const { data } = await admin
      .from("tournament_matches")
      .update({ status: "disputed", disputed_by: userId })
      .eq("id", m.id)
      .eq("status", "reported")
      .select("*");
    if (!data?.[0]) return { error: "Матч уже обновился, открой заново" };
    const names = await playerNames(admin, [m.player_a, m.player_b]);
    await notifyDispute(admin, t, data[0], names);
    return { ok: true, disputed: true };
  }
  if (m.status !== "ready") return { error: "Итог этого матча уже записан" };

  const confirmBy = confirmDeadline(t.confirm_hours).toISOString();
  const { data } = await admin
    .from("tournament_matches")
    .update({
      status: "reported",
      reported_by: userId,
      reported_winner: userId,
      reported_at: new Date().toISOString(),
      confirm_by: confirmBy,
    })
    .eq("id", m.id)
    .eq("status", "ready")
    .select("*");
  if (!data?.[0]) return { error: "Матч уже обновился, открой заново" };
  const names = await playerNames(admin, [m.player_a, m.player_b]);
  await notifyReported(admin, t, data[0], names);
  return { ok: true, reported: true, confirmBy };
}

// Соперник подтверждает победу заявившего.
export async function confirmResult(admin, matchId, userId) {
  const { m, t } = await loadMatch(admin, matchId);
  if (!m || !t) return { error: "Матч не найден" };
  if (m.status !== "reported") return { error: "Подтверждать нечего" };
  if (userId === m.reported_by || (userId !== m.player_a && userId !== m.player_b)) {
    return { error: "Подтверждает соперник" };
  }
  const res = await finish(admin, m.id, m.reported_winner, "confirmed", userId, ["reported"]);
  if (res?.error) return { error: res.error === "already" ? "Итог этого матча уже записан" : res.error };
  await afterFinish(admin, t, res, "confirmed");
  return { ok: true };
}

// Соперник не согласен — спор.
export async function disputeResult(admin, matchId, userId, note = null) {
  const { m, t } = await loadMatch(admin, matchId);
  if (!m || !t) return { error: "Матч не найден" };
  if (m.status !== "reported") return { error: "Оспаривать нечего" };
  if (userId === m.reported_by || (userId !== m.player_a && userId !== m.player_b)) {
    return { error: "Оспаривает соперник" };
  }
  const { data } = await admin
    .from("tournament_matches")
    .update({ status: "disputed", disputed_by: userId, dispute_note: note ? String(note).slice(0, 300) : null })
    .eq("id", m.id)
    .eq("status", "reported")
    .select("*");
  if (!data?.[0]) return { error: "Матч уже обновился, открой заново" };
  const names = await playerNames(admin, [m.player_a, m.player_b]);
  await notifyDispute(admin, t, data[0], names);
  return { ok: true };
}

// Решение админа: победа одного из игроков (в том числе техническая).
export async function adminDecide(admin, matchId, winnerId, actorId, method = "admin") {
  const { m, t } = await loadMatch(admin, matchId);
  if (!m || !t) return { error: "Матч не найден" };
  if (actorId === m.player_a || actorId === m.player_b) {
    return { error: "Свой матч решает другой админ" };
  }
  const res = await finish(admin, m.id, winnerId, method === "walkover" ? "walkover" : "admin", actorId, [
    "ready",
    "reported",
    "disputed",
  ]);
  if (res?.error) return { error: res.error === "already" ? "Итог этого матча уже записан" : res.error };
  await afterFinish(admin, t, res, method === "walkover" ? "walkover" : "admin");
  return { ok: true };
}

// Переиграть: матч снова «готов», срок заново.
export async function adminReplay(admin, matchId) {
  const { m, t } = await loadMatch(admin, matchId);
  if (!m || !t) return { error: "Матч не найден" };
  const { data } = await admin
    .from("tournament_matches")
    .update({
      status: "ready",
      ready_at: new Date().toISOString(),
      play_by: new Date(Date.now() + t.round_hours * 3600000).toISOString(),
      reported_by: null,
      reported_winner: null,
      reported_at: null,
      confirm_by: null,
      disputed_by: null,
      dispute_note: null,
      reminded_at: null,
      overdue_notified_at: null,
    })
    .eq("id", m.id)
    .in("status", ["ready", "reported", "disputed"])
    .select("*");
  if (!data?.[0]) return { error: "Этот матч уже завершён" };
  const matches = await allMatches(admin, t.id);
  const names = await playerNames(admin, [m.player_a, m.player_b]);
  await notifyMatchReady(admin, t, data[0], names, roundsOf(matches));
  return { ok: true };
}

export async function adminExtend(admin, matchId, hours = 12) {
  const { m } = await loadMatch(admin, matchId);
  if (!m) return { error: "Матч не найден" };
  if (m.status !== "ready") return { error: "Продлить можно только матч, который ещё не сыгран" };
  const base = Math.max(Date.now(), new Date(m.play_by ?? Date.now()).getTime());
  const { error } = await admin
    .from("tournament_matches")
    .update({ play_by: new Date(base + hours * 3600000).toISOString(), overdue_notified_at: null })
    .eq("id", m.id)
    .eq("status", "ready");
  return error ? { error: error.message } : { ok: true };
}

// Сроки: заявленная победа без ответа соперника засчитывается сама.
// Вызывается при открытии страницы турнира, из бота и из крона.
export async function sweepTournaments(admin, { tournamentId = null, limit = 30 } = {}) {
  let q = admin
    .from("tournament_matches")
    .select("id, tournament_id, reported_winner")
    .eq("status", "reported")
    .lt("confirm_by", new Date().toISOString())
    .limit(limit);
  if (tournamentId) q = q.eq("tournament_id", tournamentId);
  const { data: due } = await q;
  let done = 0;
  for (const row of due ?? []) {
    const res = await finish(admin, row.id, row.reported_winner, "auto_confirm", null, ["reported"]);
    if (res?.ok) {
      done++;
      const { data: t } = await admin.from("tournaments").select("*").eq("id", row.tournament_id).single();
      if (t) await afterFinish(admin, t, res, "auto_confirm");
    }
  }
  return { autoConfirmed: done };
}
