import { sendTelegramMessage } from "@/lib/telegramBot";
import { escapeHtml } from "@/lib/notifyUser";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import { formatCoins } from "@/lib/plural";
import { roundLabel } from "@/lib/tournamentRounds";

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
const name = (names, id) => escapeHtml(names[id]?.name ?? "Соперник");

// Итог отмечают в приложении: кнопка открывает турнир прямо из лички.
const resultKeyboard = (tid) => [openButton(tid)];
const confirmKeyboard = (tid) => [openButton(tid)];

// Матч готов: обоим игрокам — соперник, его тег, срок, кнопки.
export async function notifyMatchReady(admin, t, m, names, rounds) {
  for (const [me, opp] of [
    [m.player_a, m.player_b],
    [m.player_b, m.player_a],
  ]) {
    const tag = names[opp]?.clash_tag ? ` (тег ${escapeHtml(names[opp].clash_tag)})` : "";
    await dm(
      admin,
      me,
      `⚔️ Турнир ${title(t)}, ${roundLabel(m.round, rounds).toLowerCase()}.\n\n` +
        `Твой соперник: <b>${name(names, opp)}</b>${tag}.\n` +
        `Сыграйте дружеский бой до <b>${formatDateTimeAlmaty(m.play_by)}</b>` +
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
      `Если так, открой турнир и подтверди. Не ответишь до <b>${formatDateTimeAlmaty(m.confirm_by)}</b>, засчитаем автоматически.`,
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
    `⚠️ Спор в турнире ${title(t)}: ${name(names, m.player_a)} против ${name(names, m.player_b)}.\n` +
    `Оба считают, что выиграли. Реши в админке: Игры → Турниры.`;
  for (const a of admins ?? []) {
    if (a.id === m.player_a || a.id === m.player_b) continue;
    await dm(admin, a.id, text, [[{ text: "Открыть", web_app: { url: `${APP_URL}/admin/tournaments/${t.id}` } }]]);
  }
}

// Итог матча: проигравшему — что выбыл, победителю — что прошёл или выиграл.
export async function notifyFinished(admin, t, res, names) {
  if (!res?.ok) return;
  if (res.loser) {
    await dm(admin, res.loser, `Турнир ${title(t)}: дальше проходит ${name(names, res.winner)}. Для тебя турнир закончен, спасибо за игру!`);
  }
  if (res.final) {
    const pool = (res.payout?.pool ?? 0) + (res.payout?.bonus ?? 0);
    await dm(
      admin,
      res.winner,
      `🏆 Победа в турнире ${title(t)}!` + (pool > 0 ? ` Банк ${formatCoins(pool)} уже на балансе.` : "")
    );
    await announce(
      t,
      `🏆 Победитель турнира ${title(t)}: <b>${name(names, res.winner)}</b>!` +
        (pool > 0 ? ` Банк <b>${formatCoins(pool)}</b> уже на балансе.` : "")
    );
  } else if (!res.next_ready) {
    await dm(admin, res.winner, `✅ Турнир ${title(t)}: ты проходишь дальше. Как только станет известен соперник, напишу.`);
  }
}

export async function announceRegistration(t) {
  const fee = t.entry_fee > 0 ? `Взнос ${formatCoins(t.entry_fee)}, весь банк забирает победитель.` : "Участие бесплатное.";
  const bonus = t.bonus_coins > 0 ? ` Pacto добавляет в банк ${formatCoins(t.bonus_coins)}.` : "";
  const until = t.registration_ends_at ? `\nЗапись до ${formatDateTimeAlmaty(t.registration_ends_at)}.` : "";
  await announce(
    t,
    `🏆 <b>Турнир по Clash Royale ${title(t)}</b>\n\n${fee}${bonus}${until}\n\n` +
      `Записаться: PactoCoins → Игры → Турнир.`
  );
}

export async function announceStart(t, matches, names, rounds) {
  const pairs = matches
    .filter((m) => m.round === 1 && m.player_a && m.player_b)
    .map((m) => `${name(names, m.player_a)} против ${name(names, m.player_b)}`);
  const pot = t.pot_coins > 0 ? `\nБанк: <b>${formatCoins(t.pot_coins)}</b>.` : "";
  await announce(
    t,
    `⚔️ Турнир ${title(t)} начался! ${roundLabel(1, rounds)}:\n\n${pairs.join("\n")}${pot}`
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

export async function notifyJoined(admin, t, userId) {
  await dm(
    admin,
    userId,
    `Ты в турнире ${title(t)}.` +
      (t.entry_fee > 0 ? ` Взнос ${formatCoins(t.entry_fee)} ушёл в общий банк.` : "") +
      ` Когда сетка будет готова, я напишу, с кем ты играешь.`
  );
}
