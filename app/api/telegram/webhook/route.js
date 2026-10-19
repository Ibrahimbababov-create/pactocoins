import { NextResponse } from "next/server";
import { cancelApprovedRevenue } from "@/lib/cancelRevenue";
import {
  approveRevenueRequestInternal,
  rejectRevenueRequestInternal,
  approveBonusRequestInternal,
  rejectBonusRequestInternal,
  approvePurchaseRequestInternal,
  rejectPurchaseRequestInternal,
  approveJoinRequestInternal,
  rejectJoinRequestInternal,
} from "@/lib/telegramApprovals";
import {
  editTelegramMessage,
  answerCallbackQuery,
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramDocument,
} from "@/lib/telegramBot";
import { createAdminClient } from "@/lib/supabase-admin";
import { welcomeNewMembers, sendWelcomePreview } from "@/lib/groupWelcome";
import { renderRatingImage } from "@/lib/ratingImage";
import { getEarningsForRange } from "@/lib/weeklyMonthlyReport";
import { buildEarningsReportPdf } from "@/lib/pdfReport";
import { lastWeekRangeAlmaty, lastMonthRangeAlmaty } from "@/lib/timezone";
import { renderRevenueCommand } from "@/lib/revenueTop";
import { syncBotCommands } from "@/lib/botCommands";

export const maxDuration = 30;

const RATING_CMDS = new Set(["/rating", "/rating_week", "/rating_month"]);
// Топы и «сегодня» раньше считались по Google-таблицам (sales-bot). Теперь —
// PactoCoins, по записанной и подтверждённой выручке, как рейтинг в
// приложении. Открыты всем в группе.
const TOP_CMDS = new Set(["/top5", "/topall", "/topteam", "/today", "/todayteam"]);
const REPORT_CMDS = new Set(["/report", "/report_month"]);

// /all может стоять где угодно в сообщении (обычно в конце анонса).
const ALL_RE = /(^|\s)\/all(@[a-z0-9_]+)?(\s|$)/i;

function escapeHtml(s) {
  return String(s).replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])
  );
}

// Telegram не отдаёт боту список участников группы, поэтому мы копим ростер
// сами: каждого, кто хоть раз что-то написал или зашёл в чат, запоминаем в
// chat_members. Плюс добавляем всех активных сотрудников из базы — на случай
// молчунов, которые после подключения ростера ещё ничего не писали.
async function recordChatMembers(msg) {
  const type = msg.chat?.type;
  if (type !== "group" && type !== "supergroup") return;

  const chatId = msg.chat.id;
  const admin = createAdminClient();
  const rows = [];

  const add = (u) => {
    if (!u || u.is_bot || !u.id) return;
    const name =
      [u.first_name, u.last_name].filter(Boolean).join(" ") ||
      u.username ||
      "участник";
    rows.push({
      chat_id: chatId,
      user_id: u.id,
      name,
      username: u.username ?? null,
      last_seen: new Date().toISOString(),
    });
  };

  add(msg.from);
  (msg.new_chat_members || []).forEach(add);

  if (msg.left_chat_member?.id) {
    await admin
      .from("chat_members")
      .delete()
      .eq("chat_id", chatId)
      .eq("user_id", msg.left_chat_member.id);
  }

  if (rows.length) {
    await admin
      .from("chat_members")
      .upsert(rows, { onConflict: "chat_id,user_id" });
  }
}

// Тегаем всех участников чата (по накопленному ростеру + базе сотрудников) —
// ответом на сообщение, в котором был /all.
async function handleAllCommand(msg) {
  const admin = createAdminClient();

  const { data: caller } = await admin
    .from("users")
    .select("role")
    .eq("telegram_id", msg.from?.id)
    .maybeSingle();

  console.log(
    "[all] from",
    msg.from?.id,
    msg.from?.username ?? "",
    "sender_chat",
    msg.sender_chat?.id ?? "-",
    "role",
    caller?.role ?? "нет в базе",
    "chat",
    msg.chat?.id
  );

  // Тихо игнорируем, если пишет не админ/РОП — чтобы не спамить в группе.
  if (!["admin", "rop"].includes(caller?.role)) return;

  const [{ data: roster }, { data: staff }] = await Promise.all([
    admin
      .from("chat_members")
      .select("user_id, name")
      .eq("chat_id", msg.chat.id),
    admin
      .from("users")
      .select("name, telegram_id")
      .in("role", ["mop", "rop"])
      .eq("is_active", true)
      .eq("is_guest", false)
      .not("telegram_id", "is", null)
      .not("email", "like", "%.test@pactocoins.local"),
  ]);

  const rosterIds = new Set((roster || []).map((r) => String(r.user_id)));

  // Список сотрудников из базы подставляем только в рабочих чатах — там, где
  // кто-то из команды уже писал, либо это основной чат согласований. В личной
  // группе (семья и т.п.) тегаем строго тех, кто есть в этом чате.
  const announceChat = String(process.env.TELEGRAM_ANNOUNCE_CHAT_ID || "");
  const isWorkChat =
    (announceChat && String(msg.chat.id) === announceChat) ||
    (staff || []).some((s) => rosterIds.has(String(s.telegram_id)));

  const byId = new Map();
  for (const r of roster || []) {
    byId.set(String(r.user_id), r.name || "участник");
  }
  if (isWorkChat) {
    for (const s of staff || []) {
      byId.set(
        String(s.telegram_id),
        s.name || byId.get(String(s.telegram_id)) || "сотрудник"
      );
    }
  }

  // Самого автора не тегаем — он и так тут.
  if (msg.from?.id) byId.delete(String(msg.from.id));

  if (byId.size === 0) {
    await sendTelegramMessage(
      msg.chat.id,
      "Пока некого тегать, ещё никто не засветился в чате.",
      undefined,
      msg.message_thread_id,
      msg.message_id
    );
    return;
  }

  // Прячем упоминания за невидимым символом — сообщение остаётся коротким
  // ("📣 Всем"), но каждый привязанный пользователь получает пинг.
  const mentions = [...byId.keys()]
    .map((id) => `<a href="tg://user?id=${id}">⁣</a>`)
    .join("");

  const res = await sendTelegramMessage(
    msg.chat.id,
    `📣 Всем${mentions}`,
    undefined,
    msg.message_thread_id,
    msg.message_id
  );
  console.log("[all] tagged", byId.size, "ok", res?.ok, res?.description ?? "");

  if (!res?.ok) {
    // Не прошло — говорим автору в личку, почему, а не молчим.
    await sendTelegramMessage(
      msg.from.id,
      `📣 /all не сработал — ${escapeHtml(explainTelegramError(res?.description))}`
    );
  }
}

// Телеграм объясняет отказы по-английски и очень сухо. Переводим в
// понятное «что случилось и что с этим делать».
function explainTelegramError(desc) {
  const d = String(desc || "");
  if (/TOPIC_CLOSED/i.test(d)) {
    return "тема закрыта, в неё нельзя писать. Открой её (меню темы → «Открыть тему») либо дай боту право «Управление темами» в настройках группы — тогда он сможет писать и в закрытые.";
  }
  if (/TOPIC_DELETED/i.test(d)) return "тему удалили.";
  if (/not enough rights|CHAT_WRITE_FORBIDDEN|have no rights/i.test(d)) {
    return "боту запрещено писать в этот чат. Проверь его права в настройках группы.";
  }
  if (/message to be replied not found|replied message not found/i.test(d)) {
    return "сообщение, на которое он отвечал, уже удалено.";
  }
  if (/bot was kicked|bot is not a member/i.test(d)) return "бота нет в этом чате.";
  if (/too many requests|retry after/i.test(d)) return "слишком часто, Телеграм попросил подождать.";
  return d || "Telegram не ответил";
}

function parseCommand(text) {
  if (!text) return null;
  const first = text.trim().split(/\s+/)[0].toLowerCase();
  const cmd = first.replace(/@[a-z0-9_]+$/i, "");
  return cmd.startsWith("/") ? cmd : null;
}

async function handleRatingCommand(msg, cmd) {
  const admin = createAdminClient();
  const fromId = msg.from?.id;

  const { data: caller, error: callerErr } = await admin
    .from("users")
    .select("role")
    .eq("telegram_id", fromId)
    .maybeSingle();

  console.log("[rating cmd]", {
    cmd,
    fromId,
    chatId: msg.chat?.id,
    chatType: msg.chat?.type,
    threadId: msg.message_thread_id,
    callerRole: caller?.role ?? null,
    callerErr: callerErr?.message ?? null,
  });

  if (caller?.role !== "admin") {
    await sendTelegramMessage(
      msg.chat.id,
      "Команда доступна только админам.",
      undefined,
      msg.message_thread_id
    );
    return;
  }

  const period = cmd === "/rating_month" ? "month" : "week";
  try {
    const png = await renderRatingImage(admin, period);
    const res = await sendTelegramPhoto(
      msg.chat.id,
      png,
      `🏆 Рейтинг · ${period === "month" ? "месяц" : "неделя"}`,
      "image/png",
      msg.message_thread_id
    );
    console.log("[rating cmd] photo sent:", JSON.stringify(res));
  } catch (err) {
    console.error("[rating cmd] failed:", err);
    await sendTelegramMessage(
      msg.chat.id,
      "Не получилось собрать картинку рейтинга.",
      undefined,
      msg.message_thread_id
    );
  }
}

// Тот же отчёт, что бот присылает по понедельникам, но по команде —
// чтобы не ждать неделю, если нужно свериться прямо сейчас.
async function handleReportCommand(msg, cmd) {
  const admin = createAdminClient();
  const { data: caller } = await admin
    .from("users")
    .select("role")
    .eq("telegram_id", msg.from?.id)
    .maybeSingle();

  if (caller?.role !== "admin") {
    await sendTelegramMessage(
      msg.chat.id,
      "Команда доступна только админам.",
      undefined,
      msg.message_thread_id
    );
    return;
  }

  const isMonth = cmd === "/report_month";
  try {
    const { start, end, label } = isMonth
      ? lastMonthRangeAlmaty()
      : lastWeekRangeAlmaty();
    const period = isMonth ? label : `неделю ${label}`;
    const rows = await getEarningsForRange({ start, end });
    const pdf = await buildEarningsReportPdf({
      title: `Отчёт PactoCoins — ${isMonth ? label : `неделя ${label}`}`,
      rows,
    });
    await sendTelegramDocument(
      msg.chat.id,
      pdf,
      `pactocoins-${label.replace(/\s/g, "-")}.pdf`,
      `📊 Отчёт за ${period}`,
      "application/pdf",
      msg.message_thread_id
    );
  } catch (err) {
    console.error("[report cmd] failed:", err);
    await sendTelegramMessage(
      msg.chat.id,
      "Не получилось собрать отчёт.",
      undefined,
      msg.message_thread_id
    );
  }
}

// Топы и «сегодня» открыты всем в группе: соревнование видно каждому.
async function handleTopCommand(msg, cmd) {
  try {
    const text = await renderRevenueCommand(createAdminClient(), cmd);
    await sendTelegramMessage(msg.chat.id, text, undefined, msg.message_thread_id);
  } catch (err) {
    console.error("[top] failed:", err);
    await sendTelegramMessage(
      msg.chat.id,
      "Не получилось собрать цифры.",
      undefined,
      msg.message_thread_id
    );
  }
}

const COIN_ACTIONS = new Set([
  "approve_rev",
  "reject_rev",
  "approve_bonus",
  "reject_bonus",
  "approve_purchase",
  "reject_purchase",
  "approve_join",
  "reject_join",
]);

// Кнопки «одобрить/отклонить» двигают коины, а коины — это реальные деньги.
// Проверяем, что нажал именно админ, а не кто угодно, кто дотянулся до
// этого адреса. Одной проверки секретного токена мало: она говорит только
// «запрос пришёл от Telegram», но не «нажал тот, кому можно».
async function telegramRole(fromId) {
  if (!fromId) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("role")
    .eq("telegram_id", fromId)
    .eq("is_active", true)
    .maybeSingle();
  return data?.role ?? null;
}

// /отменить в ответ на сообщение о подтверждённой оплате. Ибрагим правит
// ошибки прямо в группе, не заходя в приложение: ответил на заявку, написал
// команду — оплата снята, коины списаны, из рейтинга ушла.
const CANCEL_CMDS = new Set(["/отменить", "/отмена", "/cancel"]);

async function handleCancelCommand(msg) {
  const chatId = msg.chat?.id;
  const threadId = msg.is_topic_message ? msg.message_thread_id : undefined;
  const say = (text) =>
    sendTelegramMessage(chatId, text, undefined, threadId, msg.message_id);

  if (!(await isTelegramAdmin(msg.from?.id))) {
    await say("Отменять оплаты может только админ.");
    return;
  }

  const repliedId = msg.reply_to_message?.message_id;
  if (!repliedId) {
    await say(
      "Ответь этой командой на сообщение с оплатой, которую нужно отменить."
    );
    return;
  }

  const admin = createAdminClient();
  const { data: request } = await admin
    .from("revenue_requests")
    .select("id, status, amount_kzt, user_id")
    .eq("admin_chat_id", chatId)
    .eq("admin_message_id", repliedId)
    .maybeSingle();

  if (!request) {
    await say(
      "Это сообщение не про оплату. Ответь на заявку на выручку, на ту, где были кнопки «Подтвердить» и «Отклонить»."
    );
    return;
  }

  // Комментарий после команды уходит человеку вместе с уведомлением.
  const comment = String(msg.text || "").trim().split(/\s+/).slice(1).join(" ");

  const res = await cancelApprovedRevenue(admin, request.id, {
    byUserId: await adminUserId(msg.from?.id),
    comment,
  });

  if (res.error) {
    await say(res.error);
    return;
  }

  const { data: person } = await admin
    .from("users")
    .select("name")
    .eq("id", res.request.user_id)
    .maybeSingle();

  const sum = res.request.amount_kzt.toLocaleString("ru-RU");
  await say(
    `❌ Оплата отменена: ${escapeHtml(person?.name ?? "сотрудник")} — ${sum} ₸` +
      (res.coins ? `, списано ${res.coins} коинов` : "")
  );

  // Перечёркиваем исходное сообщение, чтобы в группе не осталось
  // «✅ Подтверждено» рядом с уже отменённой оплатой.
  await editTelegramMessage(
    chatId,
    repliedId,
    `❌ <b>Оплата отменена</b>\n\n<s>${escapeHtml(
      person?.name ?? "сотрудник"
    )} — ${sum} ₸</s>`
  );
}

// /потрачено 45000 в ответ на заявку на покупку — записывает, во сколько
// покупка обошлась на самом деле. Та же сумма, что в админке в поле
// «Потрачено, ₸»: из неё считается бюджет и стоимость программы.
const SPEND_CMDS = new Set(["/потрачено", "/сумма", "/spent"]);

// «45 000», «45000», «45к», «45k» — всё это 45000. Пустое значение, 0 или
// прочерк стирают ранее записанную сумму.
function parseSpendAmount(raw) {
  const text = String(raw ?? "").trim().toLowerCase().replace(/\s|_/g, "");
  if (!text || text === "-" || text === "0") return { value: null };

  const m = text.match(/^(\d+(?:[.,]\d+)?)(к|k|тыс|k₸)?₸?$/);
  if (!m) return { error: true };

  let value = Number(m[1].replace(",", "."));
  if (m[2]) value *= 1000;
  if (!Number.isFinite(value) || value < 0) return { error: true };
  return { value: Math.round(value) };
}

async function handleSpendCommand(msg) {
  const chatId = msg.chat?.id;
  const threadId = msg.is_topic_message ? msg.message_thread_id : undefined;
  const say = (text) =>
    sendTelegramMessage(chatId, text, undefined, threadId, msg.message_id);

  if (!(await isTelegramAdmin(msg.from?.id))) {
    await say("Записывать потраченное может только админ.");
    return;
  }

  const repliedId = msg.reply_to_message?.message_id;
  if (!repliedId) {
    await say("Ответь этой командой на заявку на покупку и напиши сумму: /потрачено 45000");
    return;
  }

  const arg = String(msg.text || "").trim().split(/\s+/).slice(1).join(" ");
  if (!arg) {
    await say(
      "Напиши сумму после команды: /потрачено 45000 (можно 45к). Стереть записанное: /потрачено -"
    );
    return;
  }

  const parsed = parseSpendAmount(arg);
  if (parsed.error) {
    await say("Не понял сумму. Пиши так: /потрачено 45000 (можно 45к).");
    return;
  }

  const admin = createAdminClient();
  const { data: purchase } = await admin
    .from("purchase_requests")
    .select("id, status, price_coins, variant_label, user_id, rewards(title)")
    .eq("admin_chat_id", chatId)
    .eq("admin_message_id", repliedId)
    .maybeSingle();

  if (!purchase) {
    await say("Это сообщение не про покупку. Ответь на заявку на награду.");
    return;
  }

  if (purchase.status === "rejected") {
    await say("Эта покупка отклонена, денег на неё не ушло, записывать нечего.");
    return;
  }

  const { error } = await admin
    .from("purchase_requests")
    .update({ actual_kzt_amount: parsed.value })
    .eq("id", purchase.id);

  if (error) {
    await say("Не получилось записать сумму, попробуй ещё раз.");
    return;
  }

  const { data: person } = await admin
    .from("users")
    .select("name")
    .eq("id", purchase.user_id)
    .maybeSingle();

  const title = purchase.rewards?.title ?? "награда";
  const who = person?.name ?? "сотрудник";

  await say(
    parsed.value === null
      ? `Сумма по «${escapeHtml(title)}» (${escapeHtml(who)}) стёрта.`
      : `💸 Записал: «${escapeHtml(title)}» для ${escapeHtml(who)} — ` +
          `${parsed.value.toLocaleString("ru-RU")} ₸. Ушло в бюджет.`
  );
}

// id админа в нашей базе — чтобы в истории было видно, кто отменил.
async function adminUserId(telegramId) {
  if (!telegramId) return null;
  const { data } = await createAdminClient()
    .from("users")
    .select("id")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  return data?.id ?? null;
}

async function isTelegramAdmin(fromId) {
  return (await telegramRole(fromId)) === "admin";
}

// Наставник жмёт те же кнопки, что и админ: он ведёт новичков с первого
// дня и разбирает заявки наравне. Решение Ибрагима, октябрь 2026.
async function canPressButton(fromId) {
  const role = await telegramRole(fromId);
  return role === "admin" || role === "mentor";
}

const REPLY_COMMENT_TABLES = [
  "revenue_requests",
  "bonus_requests",
  "purchase_requests",
  "join_requests",
];

// Админ отвечает (reply) прямо на уведомление о заявке в группе — этот
// текст сохраняем как комментарий и подтягиваем его при одобрении/отклонении
// кнопкой на этом же сообщении. Так же работает reply-механика в другом
// боте Ибрагима (там реплай двигает дату/название в таблице).
async function handleAdminReplyComment(msg) {
  const repliedId = msg?.reply_to_message?.message_id;
  if (!repliedId || !msg.text || !msg.chat?.id) return false;
  if (!(await canPressButton(msg.from?.id))) return false;

  const admin = createAdminClient();

  for (const table of REPLY_COMMENT_TABLES) {
    const { data: row } = await admin
      .from(table)
      .select("id")
      .eq("admin_chat_id", msg.chat.id)
      .eq("admin_message_id", repliedId)
      .eq("status", "pending")
      .maybeSingle();

    if (row) {
      await admin
        .from(table)
        .update({ admin_reply_comment: msg.text })
        .eq("id", row.id);

      await sendTelegramMessage(
        msg.chat.id,
        "💬 Сохранил — добавлю к решению по заявке.",
        undefined,
        msg.message_thread_id,
        msg.message_id
      );
      return true;
    }
  }

  return false;
}

async function forwardToSalesBot(update) {
  const baseUrl = process.env.SALES_BOT_URL;
  if (!baseUrl) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    await fetch(`${baseUrl}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": process.env.SALES_BOT_SECRET || "",
      },
      body: JSON.stringify(update),
      signal: controller.signal,
    });
  } catch (err) {
    console.error("Failed to forward update to sales-bot:", err);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request) {
  // Telegram подписывает каждый свой запрос заголовком с секретом, который
  // мы задали в setWebhook. Без этой проверки адрес вебхука — просто
  // открытая дверь: кто угодно может прислать поддельное «нажатие кнопки».
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  // Нет секрета в окружении — значит проверять нечем, и дверь закрыта.
  // Раньше в этом случае проверка просто пропускалась: стоило переменной
  // потеряться при переносе, и вебхук молча становился открытым.
  if (!expectedSecret) {
    console.error("[webhook] TELEGRAM_WEBHOOK_SECRET не задан — запрос отклонён");
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const given = request.headers.get("x-telegram-bot-api-secret-token");
  if (given !== expectedSecret) {
    console.warn("[webhook] отклонён запрос с неверным секретом");
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const update = await request.json();

  // Команды бота на картинку рейтинга (только для админов).
  const msg = update.message || update.edited_message;

  // Копим ростер участников групп для /all — Telegram список не отдаёт.
  if (msg) {
    try {
      await recordChatMembers(msg);
    } catch (err) {
      console.error("[roster] failed:", err);
    }
    if (msg.new_chat_members?.length) {
      try {
        await welcomeNewMembers(msg);
      } catch (err) {
        console.error("[welcome] failed:", err);
      }
    }
  }

  if (msg?.text && ALL_RE.test(msg.text)) {
    await handleAllCommand(msg);
    return NextResponse.json({ ok: true });
  }

  // Реплай админа на уведомление о заявке — сохраняем как комментарий,
  // не даём улететь дальше как обычному тексту.
  if (msg?.reply_to_message && msg.text && !parseCommand(msg.text)) {
    if (await handleAdminReplyComment(msg)) {
      return NextResponse.json({ ok: true });
    }
  }

  const cmd = parseCommand(msg?.text);
  if (cmd) {
    console.log("[webhook] command:", cmd, "chat", msg.chat?.type, msg.chat?.id);
    if (RATING_CMDS.has(cmd)) {
      await handleRatingCommand(msg, cmd);
      return NextResponse.json({ ok: true });
    }
    if (TOP_CMDS.has(cmd)) {
      await handleTopCommand(msg, cmd);
      return NextResponse.json({ ok: true });
    }
    if (REPORT_CMDS.has(cmd)) {
      await handleReportCommand(msg, cmd);
      return NextResponse.json({ ok: true });
    }
    if (CANCEL_CMDS.has(cmd)) {
      await handleCancelCommand(msg);
      return NextResponse.json({ ok: true });
    }
    if (SPEND_CMDS.has(cmd)) {
      await handleSpendCommand(msg);
      return NextResponse.json({ ok: true });
    }
    // Админ обновляет меню команд бота сразу, не дожидаясь ночного крона.
    if (cmd === "/syncmenu") {
      const { data: caller } = await createAdminClient()
        .from("users")
        .select("role")
        .eq("telegram_id", msg.from?.id)
        .maybeSingle();
      if (caller?.role === "admin") {
        // Набрали в группе — эта группа и получает расширенный список.
        const res = await syncBotCommands({
          chatId: msg.chat?.type === "private" ? null : msg.chat?.id,
        });
        let text;
        if (res?.ok) {
          text = `Меню обновлено: ${res.after.map((c) => "/" + c).join(", ")}`;
          if (res.group) {
            text += `\n\nВ этой группе дополнительно: ${res.group
              .filter((c) => !res.after.includes(c))
              .map((c) => "/" + c)
              .join(", ")}`;
          }
        } else {
          text = `Не получилось обновить меню: ${escapeHtml(
            res?.error || "Telegram не ответил"
          )}`;
        }
        await sendTelegramMessage(
          msg.chat.id,
          text,
          undefined,
          msg.message_thread_id
        );
      }
      return NextResponse.json({ ok: true });
    }
    // Админ проверяет, как выглядит приветствие новичка: бот шлёт его
    // самому админу, остальные в группе ничего не видят.
    if (cmd === "/welcometest") {
      const admin = createAdminClient();
      const { data: caller } = await admin
        .from("users")
        .select("role")
        .eq("telegram_id", msg.from?.id)
        .maybeSingle();
      if (caller?.role === "admin" && msg.chat?.type !== "private") {
        const res = await sendWelcomePreview(
          msg.chat.id,
          msg.is_topic_message ? msg.message_thread_id : undefined,
          msg.from
        );
        if (!res?.ok) {
          await sendTelegramMessage(
            msg.from.id,
            `Приветствие не отправилось: ${escapeHtml(res?.description || "нет ответа")}`
          );
        }
      }
      return NextResponse.json({ ok: true });
    }
    if (cmd === "/start" && msg.chat?.type === "private") {
      await sendTelegramMessage(
        msg.chat.id,
        "Привет! Это бот Pacto.\n\n" +
          "Здесь живёт PactoCoins, наше приложение: в нём ты учишься, записываешь оплаты и получаешь за них коины, " +
          "а коины меняешь на награды в магазине.\n\n" +
          "Если ты новенький, нажми «Открыть PactoCoins» и зарегистрируйся. " +
          "Как всё устроено, написано в инструкции.\n\n" +
          "Приложение всегда можно открыть кнопкой слева от поля ввода.",
        {
          inline_keyboard: [
            [{ text: "🚀 Открыть PactoCoins", web_app: { url: "https://pactocoins.vercel.app" } }],
            [{ text: "📖 Инструкция", web_app: { url: "https://pactocoins.vercel.app/login?next=help" } }],
          ],
        }
      );
      return NextResponse.json({ ok: true });
    }
    if (cmd === "/app" || cmd === "/open") {
      if (msg.chat?.type === "private") {
        await sendTelegramMessage(msg.chat.id, "PactoCoins — жми кнопку:", {
          inline_keyboard: [
            [
              {
                text: "🚀 Открыть PactoCoins",
                web_app: { url: "https://pactocoins.vercel.app" },
              },
            ],
          ],
        });
      } else {
        await sendTelegramMessage(
          msg.chat.id,
          "Открой бота в личке, там слева от поля ввода кнопка «Открыть PactoCoins». Или добавь иконку на телефон: меню → «Вывести иконку на телефон».",
          undefined,
          msg.message_thread_id,
          msg.message_id
        );
      }
      return NextResponse.json({ ok: true });
    }
  }

  const callback = update.callback_query;
  const data = callback?.data || "";
  const [action, requestId] = data.split(":");

  const FLOW_ACTIONS = new Set([
    "reject_purchase_go",
    "keep_purchase",
  ]);

  if (!callback || (!COIN_ACTIONS.has(action) && !FLOW_ACTIONS.has(action))) {
    await forwardToSalesBot(update);
    return NextResponse.json({ ok: true });
  }

  const chatId = callback.message.chat.id;
  const messageId = callback.message.message_id;

  // Дальше идут кнопки, двигающие коины и аккаунты: админ и наставник.
  if (!(await canPressButton(callback.from?.id))) {
    console.warn("[webhook] нет прав на", action, callback.from?.id);
    // Сообщение подсказывает и настоящую причину отказа, и частый случай:
    // человек реально админ, но его Telegram не привязан к аккаунту.
    await answerCallbackQuery(
      callback.id,
      "Эти кнопки для админов и наставника. Если ты из них, твой Telegram не привязан к аккаунту, скажи Ибрагиму",
      true
    );
    return NextResponse.json({ ok: true });
  }

  // Отклонение покупки — в два шага, чтобы не отклонить случайным тапом.
  if (action === "reject_purchase") {
    await editTelegramMessage(chatId, messageId, callback.message.text, {
      inline_keyboard: [
        [
          { text: "✅ Оставить", callback_data: `keep_purchase:${requestId}` },
          {
            text: "❌ Точно отклонить",
            callback_data: `reject_purchase_go:${requestId}`,
          },
        ],
      ],
    });
    await answerCallbackQuery(callback.id, "Подтверди отклонение");
    return NextResponse.json({ ok: true });
  }

  if (action === "keep_purchase") {
    await editTelegramMessage(chatId, messageId, callback.message.text, {
      inline_keyboard: [
        [
          {
            text: "✅ Подтвердить",
            callback_data: `approve_purchase:${requestId}`,
          },
          {
            text: "❌ Отклонить",
            callback_data: `reject_purchase:${requestId}`,
          },
        ],
      ],
    });
    await answerCallbackQuery(callback.id, "Отменено");
    return NextResponse.json({ ok: true });
  }

  const actionMap = {
    approve_rev: approveRevenueRequestInternal,
    reject_rev: rejectRevenueRequestInternal,
    approve_bonus: approveBonusRequestInternal,
    reject_bonus: rejectBonusRequestInternal,
    approve_purchase: approvePurchaseRequestInternal,
    reject_purchase_go: rejectPurchaseRequestInternal,
    approve_join: approveJoinRequestInternal,
    reject_join: rejectJoinRequestInternal,
  };

  const handler = actionMap[action];

  if (handler) {
    const passActor =
      action === "approve_purchase" || action === "reject_purchase_go";
    const result = passActor
      ? await handler(requestId, callback.from.id)
      : await handler(requestId);

    if (result.error) {
      await answerCallbackQuery(callback.id, result.error);
      return NextResponse.json({ ok: true });
    }

    const resultLabel = action.startsWith("approve")
      ? "✅ Подтверждено"
      : "❌ Отклонено";

    const actorName =
      callback.from.first_name +
      (callback.from.last_name ? ` ${callback.from.last_name}` : "");

    await editTelegramMessage(
      chatId,
      messageId,
      `${escapeHtml(callback.message.text ?? "")}\n\n<b>${resultLabel}</b> (${escapeHtml(actorName)})`
    );

    await answerCallbackQuery(callback.id, resultLabel);
  }

  return NextResponse.json({ ok: true });
}
