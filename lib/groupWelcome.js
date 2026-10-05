import { createAdminClient } from "@/lib/supabase-admin";
import { TEAM_CHAT_ID } from "@/lib/teamGroup";

const API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

function escapeHtml(s) {
  return String(s).replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])
  );
}

let usernamePromise;
function botUsername() {
  usernamePromise ??= fetch(`${API}/getMe`)
    .then((r) => r.json())
    .then((d) => d?.result?.username ?? null)
    .catch(() => null);
  return usernamePromise;
}

function welcomeText(name) {
  return (
    `👋 <b>${escapeHtml(name)}, добро пожаловать в Pacto!</b>\n` +
    `<i>Это сообщение видишь только ты.</i>\n\n` +
    `<b>Что сделать сейчас (3 шага):</b>\n\n` +
    `1️⃣ Нажми кнопку <b>«🚀 Открыть PactoCoins»</b> под этим сообщением.\n\n` +
    `2️⃣ Выбери <b>«✅ Зарегистрироваться»</b> и заполни:\n` +
    `   • имя и фамилию;\n` +
    `   • «К кому ты идёшь» — новички выбирают <b>наставника</b>;\n` +
    `   • день рождения — в этот день подарим 3000 коинов.\n\n` +
    `3️⃣ Жди подтверждения — обычно это быстро. Потом просто открой приложение ещё раз.\n\n` +
    `<b>Что дальше:</b>\n` +
    `🎓 Первые дни ты стажёр: в приложении вкладка <b>«Обучение»</b> — материалы и тесты на 3 дня. ` +
    `Первая оплата — и ты МОП.\n` +
    `💰 С каждой оплаты: чек кидаешь в эту группу, а в приложении жмёшь <b>«Записать выручку»</b>. ` +
    `1000 ₸ = 1 коин, коины меняешь на награды в магазине.`
  );
}

async function keyboardAndLink() {
  const username = await botUsername();
  const appLink = username
    ? `https://t.me/${username}?startapp`
    : "https://pactocoins.vercel.app";
  const keyboard = {
    inline_keyboard: [
      [{ text: "🚀 Открыть PactoCoins", url: appLink }],
      ...(username
        ? [[{ text: "💬 Написать боту", url: `https://t.me/${username}` }]]
        : []),
    ],
  };
  return { appLink, keyboard };
}

// Шлёт приветствие, которое видит только user (эфемерное сообщение,
// Bot API 10.2). Если кнопки не прошли — повтор со ссылкой в тексте.
export async function sendWelcome(chatId, threadId, user) {
  const { appLink, keyboard } = await keyboardAndLink();
  const name = user.first_name || user.username || "привет";

  const send = (withKeyboard) =>
    fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_thread_id: threadId,
        text:
          welcomeText(name) +
          (withKeyboard ? "" : `\n\n🚀 <a href="${appLink}">Открыть PactoCoins</a>`),
        parse_mode: "HTML",
        reply_markup: withKeyboard ? keyboard : undefined,
        link_preview_options: { is_disabled: true },
        ephemeral_message_parameters: { receiver_user_id: user.id },
      }),
    })
      .then((r) => r.json())
      .catch((err) => ({ ok: false, description: String(err) }));

  let res = await send(true);
  if (!res?.ok) {
    console.error("[welcome] с кнопками не ушло", user.id, res?.description);
    res = await send(false);
  }
  if (!res?.ok) {
    console.error("[welcome] не отправилось", user.id, res?.description);
  }
  return res;
}

// Новичок зашёл в рабочую группу → приветствие ему одному. Уже работающим
// сотрудникам (вернулись в группу) не шлём.
export async function welcomeNewMembers(msg) {
  if (String(msg.chat?.id) !== String(TEAM_CHAT_ID)) return;

  const newbies = (msg.new_chat_members || []).filter((u) => u?.id && !u.is_bot);
  if (!newbies.length) return;

  const admin = createAdminClient();
  const { data: known } = await admin
    .from("users")
    .select("telegram_id")
    .in(
      "telegram_id",
      newbies.map((u) => u.id)
    )
    .eq("is_active", true);
  const knownIds = new Set((known || []).map((u) => String(u.telegram_id)));

  const threadId = msg.is_topic_message ? msg.message_thread_id : undefined;
  for (const u of newbies) {
    if (knownIds.has(String(u.id))) continue;
    await sendWelcome(msg.chat.id, threadId, u);
  }
}
