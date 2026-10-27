import { clearTelegramButtons, setTelegramStatusButton } from "@/lib/telegramBot";

// Таблицы, у которых есть admin_chat_id / admin_message_id (сообщение с
// кнопками в рабочей группе), и тема группы, куда это сообщение уходило.
function threadFor(table) {
  const num = (v) => (v ? Number(v) : undefined);
  switch (table) {
    case "purchase_requests":
      return num(process.env.TELEGRAM_PURCHASES_THREAD_ID);
    case "join_requests":
      return 99;
    default:
      return num(process.env.TELEGRAM_REQUESTS_THREAD_ID);
  }
}

const TABLES = new Set([
  "revenue_requests",
  "bonus_requests",
  "purchase_requests",
  "join_requests",
]);

const STATUS_LINE = {
  approved: "✅ Подтверждено в админке",
  rejected: "❌ Отклонено в админке",
  cancelled: "↩️ Отменено в админке",
};

export async function userNameById(admin, userId) {
  if (!userId) return null;
  try {
    const { data } = await admin.from("users").select("name").eq("id", userId).maybeSingle();
    return data?.name ?? null;
  } catch {
    return null;
  }
}

// Заявку обработали на сайте: вместо кнопок решения в сообщении в группе
// остаётся одна кнопка-статус, чтобы никто не жал «мёртвые» кнопки.
// Это «лучшая попытка»: любая ошибка (сообщение удалено, правке больше
// 48 часов, Телеграм не отвечает) молча игнорируется и основное действие
// не ломает. Вызывать только ПОСЛЕ успешной обработки.
export async function markTelegramRequestHandled(admin, { table, id, status, byName }) {
  try {
    if (!TABLES.has(table) || !STATUS_LINE[status]) return;
    const { data: row } = await admin
      .from(table)
      .select("admin_chat_id, admin_message_id")
      .eq("id", id)
      .maybeSingle();
    const chatId = row?.admin_chat_id;
    const messageId = row?.admin_message_id;
    if (!chatId || !messageId) return;

    // Одна кнопка-статус вместо двух кнопок решения, отдельного сообщения нет.
    // Если Телеграм отказал (сообщение старше 48 часов и т.п.), пробуем хотя бы
    // убрать кнопки.
    const label = `${STATUS_LINE[status]}${byName ? `: ${String(byName).slice(0, 24)}` : ""}`;
    try {
      const res = await setTelegramStatusButton(chatId, messageId, label);
      if (res && res.ok === false) await clearTelegramButtons(chatId, messageId);
    } catch {
      try {
        await clearTelegramButtons(chatId, messageId);
      } catch {}
    }
  } catch (err) {
    console.error("[telegramMessageSync] не удалось обновить сообщение", err);
  }
}

// Нажали кнопку под сообщением, а заявка уже закрыта. Возвращает понятный
// текст для всплывающего окна или null, если заявка всё ещё ждёт решения
// (или её не удалось найти).
export async function describeHandledRequest(admin, table, id) {
  try {
    if (!TABLES.has(table) || !id) return null;
    const { data: row } = await admin
      .from(table)
      .select("status, reviewed_by")
      .eq("id", id)
      .maybeSingle();
    if (!row || row.status === "pending") return null;
    const verb =
      row.status === "approved" || row.status === "done"
        ? "подтверждено"
        : row.status === "rejected"
        ? "отклонено"
        : null;
    if (!verb) return null;
    const name = await userNameById(admin, row.reviewed_by);
    return `Уже обработано: ${verb}${name ? ` (${name})` : ""}`;
  } catch {
    return null;
  }
}
