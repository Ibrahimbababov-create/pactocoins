import { sendTelegramMessage } from "@/lib/telegramBot";
import { escapeHtml } from "@/lib/notifyUser";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import { formatCoins, plural, spinsNom } from "@/lib/plural";
import { roundLabel } from "@/lib/tournamentRounds";
import { MODE_LINE, MODE_HOW } from "@/lib/clashMode";

// Сообщения турнира: личные (с кнопками результата) и посты в группу.
// Ни одно сообщение не должно ронять действие: ошибки только в лог.

const APP_URL = "https://pactocoins.vercel.app";
export const tournamentUrl = (id) => `${APP_URL}/mop/games/tournament/${id}`;

const openButton = (tid) => [{ text: "Открыть турнир", web_app: { url: tournamentUrl(tid) } }];

async function telegramIds(admin, userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};
  const { data } = await admin.from("users").select("id, telegram_id").in("id", ids);
  return Object.fromEntries((data ?? []).filter((u) => u.telegram_id).map((u) => [u.id, u.telegram_id]));
}

async function dm(admin, userId, text, keyboard) {
  try {
    const ids = await telegramIds(admin, [userId]);
    if (!ids[userId]) return null;
    const res = await sendTelegramMessage(ids[userId], text, keyboard ? { inline_keyboard: keyboard } : undefined);
    return res?.ok ? res.result : null;
  } catch (err) {
    console.error("[tournamentNotify] dm failed", userId, err);
    return null;
  }
}

async function announce(t, text) {
  if (t.is_test) return;
  const chat = process.env.TELEGRAM_ANNOUNCE_CHAT_ID;
  if (!chat) return;
  const thread = process.env.TELEGRAM_ANNOUNCE_THREAD_ID
    ? Number(process.env.TELEGRAM_ANNOUNCE_THREAD_ID)
    : undefined;
  try {
    await sendTelegramMessage(chat, text, undefined, thread);
  } catch (err) {
    console.error("[tournamentNotify] announce failed", err);
  }
}

const title = (t) => `«${escapeHtml(t.title)}»`;
// «20.10, 18:00»: год в сообщениях не нужен.
const shortWhen = (v) => formatDateTimeAlmaty(v).replace(/\.\d{4},/, ",");
const name = (names, id) => escapeHtml(names[id]?.name ?? "Соперник");
// Имя человека плюс его ник в игре: по имени ищут в офисе, по нику — на арене.
const nick = (names, id) => (names[id]?.clash_name ? ` (в игре ${escapeHtml(names[id].clash_name)})` : "");

// Итог отмечают в приложении: кнопка открывает турнир прямо из лички.
const resultKeyboard = (tid) => [openButton(tid)];
const confirmKeyboard = (tid) => [openButton(tid)];

// Матч готов: обоим игрокам — соперник, его тег, срок, кнопки.
export async function notifyMatchReady(admin, t, m, names, rounds) {
  for (const [me, opp] of [
    [m.player_a, m.player_b],
    [m.player_b, m.player_a],
  ]) {
    const who = names[opp] ?? {};
    const card = [
      who.clash_name ? `в игре <b>${escapeHtml(who.clash_name)}</b>` : null,
      who.clash_tag ? `тег ${escapeHtml(who.clash_tag)}` : null,
    ].filter(Boolean);
    await dm(
      admin,
      me,
      `⚔️ Турнир ${title(t)}, ${roundLabel(m.round, rounds).toLowerCase()}.\n\n` +
        `Твой соперник: <b>${name(names, opp)}</b>${card.length ? ` (${card.join(", ")})` : ""}.\n` +
        `${MODE_LINE}\n` +
        `${m.round > 0 && t.playoff_wins > 1 ? `Играйте до ${t.playoff_wins} побед. ` : ""}` +
        `Сыграйте дружеский бой до <b>${shortWhen(m.play_by)}</b>` +
        `${t.clan_tag ? ` в клане ${escapeHtml(t.clan_tag)}` : ""}.\n\n` +
        `После боя открой турнир и отметь итог. Если проигравший жмёт «Победа соперника», победитель сразу проходит дальше.`,
      resultKeyboard(t.id)
    );
  }
}

// Победитель заявил о победе — сопернику на подтверждение.
export async function notifyReported(admin, t, m, names) {
  const opp = m.reported_winner === m.player_a ? m.player_b : m.player_a;
  return dm(
    admin,
    opp,
    `${name(names, m.reported_winner)} сообщает о своей победе в вашем матче, турнир ${title(t)}.\n\n` +
      (m.round > 0 && t.playoff_wins > 1
        ? `Это серия до ${t.playoff_wins} побед: подтверждай, только если он выиграл ${t.playoff_wins} боя. Если серия не доиграна, жми «это не так».\n\n`
        : "") +
      `Если так, открой турнир и подтверди. Не ответишь до <b>${shortWhen(m.confirm_by)}</b>, засчитаем автоматически.`,
    confirmKeyboard(t.id)
  );
}

export async function notifyDispute(admin, t, m, names) {
  const { data: admins } = await admin
    .from("users")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true)
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local");
  const text =
    `⚠️ Спор в турнире ${title(t)}: ${name(names, m.player_a)} vs ${name(names, m.player_b)}.\n` +
    `Оба считают, что выиграли. Реши в админке: Меню → Турниры.`;
  for (const a of admins ?? []) {
    if (a.id === m.player_a || a.id === m.player_b) continue;
    await dm(admin, a.id, text, [[{ text: "Открыть", web_app: { url: `${APP_URL}/admin/tournaments/${t.id}` } }]]);
  }
}

// Итог матча: победителю — «победа засчитана» (в финале — про банк),
// проигравшему — только если решили без него (автозачёт по сроку, админ):
// свою «Победу соперника» или «Подтверждаю» он и так видел.
const DECIDED_WITHOUT_THEM = new Set(["auto_confirm", "admin", "walkover"]);

export async function notifyFinished(admin, t, res, names, method = null, prizes = null) {
  if (!res?.ok) return;
  const howWord = method === "auto_confirm" ? "соперник не ответил вовремя" : "решение админа";
  const why = DECIDED_WITHOUT_THEM.has(method) ? ` (${howWord})` : "";
  if (!res.final) {
    await dm(admin, res.winner, `✅ ${res.league ? "Лига" : "Турнир"} ${title(t)}: победа в матче с игроком ${name(names, res.loser)} засчитана${why}.`);
  }
  if (why) {
    await dm(admin, res.loser, `Турнир ${title(t)}: матч с игроком ${name(names, res.winner)} засчитан сопернику${why}.`);
  }
  if (res.final) {
    const pool = (res.payout?.pool ?? 0) + (res.payout?.bonus ?? 0);
    const spinsOf = (id) => prizes?.awards.find(([uid]) => uid === id)?.[1] ?? 0;
    const spinsLine = (n) => (n > 0 ? ` И ещё ${n} ${spinsNom(n)} на колесе фортуны.` : "");
    await dm(
      admin,
      res.winner,
      `🏆 Победа в турнире ${title(t)}!` +
        (pool > 0 ? ` Банк ${formatCoins(pool)} уже на балансе.` : "") +
        spinsLine(spinsOf(res.winner))
    );
    if (spinsOf(res.loser) > 0) {
      const n = spinsOf(res.loser);
      await dm(admin, res.loser, `🥈 Второе место в турнире ${title(t)}! +${n} ${spinsNom(n)} на колесе фортуны.`);
    }
    for (const id of prizes?.third ?? []) {
      const n = spinsOf(id);
      if (n > 0) await dm(admin, id, `🥉 Тройка лучших в турнире ${title(t)}! +${n} ${spinsNom(n)} на колесе фортуны.`);
    }
    const podiumLines = prizes
      ? `\n\n🥈 ${name(names, res.loser)}` +
        (prizes.third.length ? `\n🥉 ${prizes.third.map((id) => name(names, id)).join(", ")}` : "")
      : "";
    await announce(
      t,
      `🏆 Победитель турнира ${title(t)}: <b>${name(names, res.winner)}</b>!` +
        (pool > 0 ? ` Банк <b>${formatCoins(pool)}</b> уже на балансе.` : "") +
        podiumLines
    );
  }
}

export async function announceRegistration(t) {
  const fee = t.entry_fee > 0 ? `Взнос ${formatCoins(t.entry_fee)}, весь банк забирает победитель.` : "Участие бесплатное.";
  const bonus = t.bonus_coins > 0 ? ` Pacto добавляет в банк ${formatCoins(t.bonus_coins)}.` : "";
  const about = t.description ? `\n\n${escapeHtml(t.description)}` : "";
  const until = t.registration_ends_at ? `\n\nЗапись до ${shortWhen(t.registration_ends_at)}.` : "";
  await announce(
    t,
    `🏆 <b>Запись на турнир по Clash Royale ${title(t)} открыта</b>\n\n${MODE_LINE}\n\n${fee}${bonus}${about}${until}\n` +
      `Записаться: PactoCoins → Игры → ${escapeHtml(t.title)}.`
  );
}

export async function announceStart(t, matches, names, rounds) {
  const pairs = matches
    .filter((m) => m.round === 1 && m.player_a && m.player_b)
    .map((m) => `${name(names, m.player_a)}${nick(names, m.player_a)} vs ${name(names, m.player_b)}${nick(names, m.player_b)}`);
  const pot = t.pot_coins > 0 ? `\nБанк: <b>${formatCoins(t.pot_coins)}</b>.` : "";
  await announce(
    t,
    `⚔️ Турнир ${title(t)} начался! ${roundLabel(1, rounds)}:\n\n${pairs.join("\n")}${pot}\n\n${MODE_LINE}`
  );
}

export async function notifyCancelled(admin, t, userIds) {
  for (const id of userIds) {
    await dm(
      admin,
      id,
      `Турнир ${title(t)} отменён.` + (t.entry_fee > 0 ? ` Взнос ${formatCoins(t.entry_fee)} вернули на баланс.` : "")
    );
  }
}


// Старт лиги: каждому — список соперников и срок, одним сообщением.
export async function notifyLeagueStart(admin, t, matches, names) {
  const players = [...new Set(matches.flatMap((m) => [m.player_a, m.player_b]))];
  for (const me of players) {
    const opps = matches
      .filter((m) => m.player_a === me || m.player_b === me)
      .sort((x, y) => (x.tour ?? 0) - (y.tour ?? 0))
      .map((m) => {
        const id = m.player_a === me ? m.player_b : m.player_a;
        const tag = names[id]?.clash_tag ? ` ${escapeHtml(names[id].clash_tag)}` : "";
        return `${m.tour ? `Тур ${m.tour}: ` : "• "}${name(names, id)}${nick(names, id)}${tag}`;
      });
    await dm(
      admin,
      me,
      `⚔️ Лига ${title(t)} началась! Каждый играет с каждым до <b>${shortWhen(t.league_ends_at)}</b>.\n\n` +
        `<b>${MODE_LINE}</b> ${MODE_HOW}\n\n` +
        `Твои соперники по порядку:\n${opps.join("\n")}\n\n` +
        `Играй по турам, пропущенный матч можно доиграть до конца лиги. ` +
        `В плей-офф выходят лучшие ${t.playoff_size ?? 4}, он начнётся сам, как только сыграют все матчи лиги. ` +
        `После каждого боя отметь итог в турнире.`,
      [openButton(t.id)]
    );
  }
  const list = players
    .map((id) => names[id]?.name ?? "")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ru"))
    .map((n, i) => `${i + 1}. ${escapeHtml(n)}`);
  await announce(
    t,
    `⚔️ Турнир ${title(t)} начался! Играют ${players.length}:\n\n${list.join("\n")}\n\n` +
      `Лига: каждый с каждым до ${shortWhen(t.league_ends_at)}. ` +
      `Лучшие ${t.playoff_size ?? 4} сразу выходят в плей-офф${t.playoff_wins > 1 ? `, там матчи до ${t.playoff_wins} побед` : ""}.`
  );
}

// Лига сыграна — админам: можно запускать плей-офф.
export async function notifyLeagueDone(admin, t) {
  const { data: admins } = await admin
    .from("users")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true)
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local");
  for (const a of admins ?? []) {
    await dm(admin, a.id, `Лига ${title(t)} сыграна. Можно запускать плей-офф: Меню → Турниры.`, [
      [{ text: "Открыть", web_app: { url: `${APP_URL}/admin/tournaments/${t.id}` } }],
    ]);
  }
}

export async function announcePlayoff(t, standings, names, matches, rounds) {
  const top = standings.map((r) => `${r.place}. ${name(names, r.userId)}: ${r.wins} ${plural(r.wins, "победа", "победы", "побед")}`);
  const pairs = matches
    .filter((m) => m.round === 1 && m.player_a && m.player_b)
    .map((m) => `${name(names, m.player_a)}${nick(names, m.player_a)} vs ${name(names, m.player_b)}${nick(names, m.player_b)}`);
  await announce(
    t,
    `🔥 Лига закончилась, начинается плей-офф ${title(t)}!${t.playoff_wins > 1 ? ` Матчи до ${t.playoff_wins} побед.` : ""}\n\n` +
      `В плей-офф вышли:\n${top.join("\n")}\n\n${roundLabel(1, rounds)}:\n${pairs.join("\n")}\n\n${MODE_LINE}`
  );
}

export async function notifyOutOfPlayoff(admin, t, userIds) {
  for (const id of userIds) {
    await dm(admin, id, `Лига ${title(t)} закончилась, в плей-офф в этот раз не хватило побед. Спасибо за игру!`, [openButton(t.id)]);
  }
}

export async function notifyJoined(admin, t, userId) {
  await dm(
    admin,
    userId,
    `Ты в турнире ${title(t)}.` +
      (t.entry_fee > 0 ? ` Взнос ${formatCoins(t.entry_fee)} ушёл в общий банк.` : "") +
      ` Когда запись закроется, я пришлю твоих соперников.\n\n${MODE_LINE}`
  );
}

// Таблица лиги в общую группу — по кнопке админа.
export async function announceLeagueTable(t, table, names, played, total) {
  const cut = t.playoff_size ?? 4;
  const lines = table.map(
    (r) =>
      `${r.place <= cut ? "🔸" : "▫️"} ${r.place}. ${name(names, r.userId)}: ${r.wins} ${plural(r.wins, "победа", "победы", "побед")} из ${r.played}`
  );
  await announce(
    t,
    `📊 Таблица лиги ${title(t)}, сыграно ${played} из ${total}:\n\n${lines.join("\n")}\n\n🔸 сейчас проходят в плей-офф`
  );
}

// Сообщение от админа всем, кто сейчас в турнире (напомнить о старте и т.п.),
// с кнопкой «Открыть турнир». Текст админа экранируем: в нём могут быть < и &.
export async function messageEntrants(admin, tid, text) {
  const { data: entries } = await admin
    .from("tournament_entries")
    .select("user_id")
    .eq("tournament_id", tid)
    .eq("status", "active");
  const userIds = (entries ?? []).map((e) => e.user_id);
  const ids = await telegramIds(admin, userIds);
  let sent = 0;
  for (const uid of userIds) {
    if (!ids[uid]) continue;
    try {
      const res = await sendTelegramMessage(ids[uid], escapeHtml(text), { inline_keyboard: [openButton(tid)] });
      if (res?.ok) sent++;
    } catch (err) {
      console.error("[tournamentNotify] message to entrant failed", uid, err);
    }
  }
  return { sent, total: userIds.length };
}
