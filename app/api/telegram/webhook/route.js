import { NextResponse } from "next/server";
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
} from "@/lib/telegramBot";
import { createAdminClient } from "@/lib/supabase-admin";
import { renderRatingImage } from "@/lib/ratingImage";

const RATING_CMDS = new Set(["/rating", "/rating_week", "/rating_month"]);

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

  const byId = new Map();
  for (const r of roster || []) {
    byId.set(String(r.user_id), r.name || "участник");
  }
  for (const s of staff || []) {
    byId.set(
      String(s.telegram_id),
      s.name || byId.get(String(s.telegram_id)) || "сотрудник"
    );
  }

  // Самого автора не тегаем — он и так тут.
  if (msg.from?.id) byId.delete(String(msg.from.id));

  if (byId.size === 0) {
    await sendTelegramMessage(
      msg.chat.id,
      "Пока некого тегать — ещё никто не засветился в чате.",
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

  await sendTelegramMessage(
    msg.chat.id,
    `📣 Всем${mentions}`,
    undefined,
    msg.message_thread_id,
    msg.message_id
  );
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
  }

  if (msg?.text && ALL_RE.test(msg.text)) {
    await handleAllCommand(msg);
    return NextResponse.json({ ok: true });
  }

  const cmd = parseCommand(msg?.text);
  if (cmd) {
    console.log("[webhook] command:", cmd, "chat", msg.chat?.type, msg.chat?.id);
    if (RATING_CMDS.has(cmd)) {
      await handleRatingCommand(msg, cmd);
      return NextResponse.json({ ok: true });
    }
  }

  const callback = update.callback_query;
  const data = callback?.data || "";
  const [action, requestId] = data.split(":");

  if (!callback || !COIN_ACTIONS.has(action)) {
    await forwardToSalesBot(update);
    return NextResponse.json({ ok: true });
  }

  const chatId = callback.message.chat.id;
  const messageId = callback.message.message_id;

  const actionMap = {
    approve_rev: approveRevenueRequestInternal,
    reject_rev: rejectRevenueRequestInternal,
    approve_bonus: approveBonusRequestInternal,
    reject_bonus: rejectBonusRequestInternal,
    approve_purchase: approvePurchaseRequestInternal,
    reject_purchase: rejectPurchaseRequestInternal,
    approve_join: approveJoinRequestInternal,
    reject_join: rejectJoinRequestInternal,
  };

  const handler = actionMap[action];

  if (handler) {
    const result = await handler(requestId);

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
      `${callback.message.text}\n\n<b>${resultLabel}</b> (${actorName})`
    );

    await answerCallbackQuery(callback.id, resultLabel);
  }

  return NextResponse.json({ ok: true });
}
