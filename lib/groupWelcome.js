import { createAdminClient } from "@/lib/supabase-admin";
import { TEAM_CHAT_ID } from "@/lib/teamGroup";

const API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const APP_URL = "https://pactocoins.vercel.app";

// Сколько приветствие висит в General, прежде чем бот его уберёт.
const WELCOME_TTL_HOURS = 24;

function escapeHtml(s) {
  return String(s).replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])
  );
}

function tg(method, body) {
  return fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((r) => r.json())
    .catch((err) => ({ ok: false, description: String(err) }));
}

let usernamePromise;
function botUsername() {
  usernamePromise ??= fetch(`${API}/getMe`)
    .then((r) => r.json())
    .then((d) => d?.result?.username ?? null)
    .catch(() => null);
  return usernamePromise;
}

function welcomeText(user) {
  const name = escapeHtml(user.first_name || user.username || "друг");
  return (
    `Привет, <a href="tg://user?id=${user.id}">${name}</a>! Добро пожаловать в Pacto.\n\n` +
    `Для начала зарегистрируйся в PactoCoins, это наше приложение для обучения и коинов. ` +
    `Нажми «Открыть PactoCoins», выбери «Зарегистрироваться», напиши имя и фамилию, ` +
    `а в графе «К кому ты идёшь» выбери наставника. Админ подтвердит, и можно заходить.\n\n` +
    `Первые три дня ты учишься, всё лежит во вкладке «Обучение». ` +
    `Закроешь первую оплату и станешь МОПом.\n\n` +
    `После каждой оплаты кидай чек сюда в группу и записывай выручку в приложении. ` +
    `За каждую 1000 ₸ получаешь 1 коин, их потом можно потратить в магазине.\n\n` +
    `Как всё устроено подробно, написано в инструкции. Если что-то непонятно, спрашивай у наставника.`
  );
}

// Кнопки из группы ведут в мини-приложение через t.me-ссылку:
// startapp=help открывает сразу инструкцию (см. app/login/page.js).
async function welcomeKeyboard() {
  const username = await botUsername();
  const link = (param) =>
    username
      ? `https://t.me/${username}?startapp${param ? `=${param}` : ""}`
      : `${APP_URL}${param === "help" ? "/mop/help" : ""}`;
  return {
    inline_keyboard: [
      [{ text: "🚀 Открыть PactoCoins", url: link() }],
      [{ text: "📖 Инструкция", url: link("help") }],
    ],
  };
}

function sendWelcomeMessage(chatId, user, extra = {}) {
  return welcomeKeyboard().then((keyboard) =>
    tg("sendMessage", {
      chat_id: chatId,
      text: welcomeText(user),
      parse_mode: "HTML",
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
      ...extra,
    })
  );
}

// /welcometest: админ видит приветствие у себя — эфемерно, остальным не видно.
export function sendWelcomePreview(chatId, threadId, user) {
  return sendWelcomeMessage(chatId, user, {
    message_thread_id: threadId,
    ephemeral_message_parameters: { receiver_user_id: user.id },
  });
}

// Убирает приветствия старше WELCOME_TTL_HOURS. Зовётся при новом входе
// в группу и из ежедневного крона.
export async function cleanupOldWelcomes(maxAgeHours = WELCOME_TTL_HOURS) {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - maxAgeHours * 3600 * 1000).toISOString();
  const { data: old } = await admin
    .from("group_welcome_messages")
    .select("chat_id, message_id")
    .lt("created_at", cutoff);

  for (const m of old || []) {
    await tg("deleteMessage", { chat_id: m.chat_id, message_id: m.message_id });
    await admin
      .from("group_welcome_messages")
      .delete()
      .eq("chat_id", m.chat_id)
      .eq("message_id", m.message_id);
  }
  return (old || []).length;
}

// Новичок зашёл в рабочую группу → приветствие в General с его именем.
// Висит около суток, потом бот его удаляет. Уже работающим сотрудникам
// (вернулись в группу) не шлём.
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

  for (const u of newbies) {
    if (knownIds.has(String(u.id))) continue;
    // Без message_thread_id сообщение в форум-группе падает в General.
    const res = await sendWelcomeMessage(msg.chat.id, u);
    if (res?.ok) {
      await admin.from("group_welcome_messages").insert({
        chat_id: msg.chat.id,
        message_id: res.result.message_id,
        user_id: u.id,
      });
    } else {
      console.error("[welcome] не отправилось", u.id, res?.description);
    }
  }

  await cleanupOldWelcomes().catch((err) =>
    console.error("[welcome] cleanup failed:", err)
  );
}
