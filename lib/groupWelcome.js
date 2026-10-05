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
    `Привет, ${escapeHtml(name)}! Это сообщение видишь только ты.\n\n` +
    `Для начала зарегистрируйся в PactoCoins, это наше приложение для обучения и коинов. ` +
    `Нажми кнопку ниже, выбери «Зарегистрироваться», напиши имя и фамилию, ` +
    `а в графе «К кому ты идёшь» выбери наставника. Админ подтвердит, и можно заходить.\n\n` +
    `Первые три дня ты учишься, всё лежит во вкладке «Обучение». ` +
    `Закроешь первую оплату и станешь МОПом.\n\n` +
    `После каждой оплаты кидай чек сюда в группу и записывай выручку в приложении. ` +
    `За каждую 1000 ₸ получаешь 1 коин, их потом можно потратить в магазине.\n\n` +
    `Если что-то непонятно, спрашивай у наставника.`
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
