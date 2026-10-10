const API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

const CYRILLIC_TO_LATIN = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

// Cyrillic filenames get mangled somewhere in the browser->server->Telegram
// multipart chain, so transliterate to ASCII instead of trying to preserve UTF-8.
function safeFilename(name) {
  const transliterated = name
    .split("")
    .map((ch) => {
      const lower = ch.toLowerCase();
      if (CYRILLIC_TO_LATIN[lower] === undefined) return ch;
      const mapped = CYRILLIC_TO_LATIN[lower];
      return ch === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
    })
    .join("");

  return transliterated.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export async function sendTelegramMessage(
  chatId,
  text,
  replyMarkup,
  messageThreadId,
  replyToMessageId,
  { silent = false } = {}
) {
  const res = await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
      message_thread_id: messageThreadId,
      reply_to_message_id: replyToMessageId,
      // Без звука — для того, что уходит ночью (крон в 00:05 по Алматы).
      disable_notification: silent || undefined,
    }),
  });
  return res.json();
}

export async function editTelegramMessage(chatId, messageId, text, replyMarkup) {
  const res = await fetch(`${API}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup ?? { inline_keyboard: [] },
    }),
  });
  return res.json();
}

// Статус пользователя в чате: "creator" | "administrator" | "member" |
// "restricted" | "left" | "kicked", либо null если запрос не удался.
export async function getChatMemberStatus(chatId, userId) {
  try {
    const res = await fetch(`${API}/getChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
    });
    const data = await res.json();
    return data?.ok ? data.result?.status ?? null : null;
  } catch {
    return null;
  }
}

// showAlert = true — всплывающее окно вместо всплывашки сверху: нужно там,
// где отказ важно не пропустить (например «у тебя нет прав»).
export async function answerCallbackQuery(callbackQueryId, text, showAlert = false) {
  const res = await fetch(`${API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    }),
  });
  return res.json();
}

export async function sendTelegramPhoto(
  chatId,
  fileBytes,
  caption,
  mimeType = "image/jpeg",
  messageThreadId
) {
  const form = new FormData();
  form.append("chat_id", chatId);
  if (messageThreadId != null) {
    form.append("message_thread_id", String(messageThreadId));
  }
  if (caption) {
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
  }
  form.append("photo", new Blob([fileBytes], { type: mimeType }), "photo.jpg");

  const res = await fetch(`${API}/sendPhoto`, {
    method: "POST",
    body: form,
  });
  return res.json();
}

export async function sendTelegramDocument(
  chatId,
  fileBytes,
  filename,
  caption,
  mimeType = "application/octet-stream",
  threadId
) {
  const form = new FormData();
  form.append("chat_id", chatId);
  // Без номера темы файл уходит в «General» — в группе с темами его там
  // никто не видит. Именно поэтому недельные отчёты «не приходили».
  if (threadId) form.append("message_thread_id", String(threadId));
  if (caption) {
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
  }
  form.append("document", new Blob([fileBytes], { type: mimeType }), safeFilename(filename));

  const res = await fetch(`${API}/sendDocument`, {
    method: "POST",
    body: form,
  });
  return res.json();
}

// Убрать кнопки у сообщения (текст не трогаем) — когда заявку закрыли
// не через эти кнопки, например сотрудник сам её отозвал.
export async function clearTelegramButtons(chatId, messageId) {
  const res = await fetch(`${API}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    }),
  });
  return res.json();
}
