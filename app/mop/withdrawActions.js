"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { sendTelegramMessage, clearTelegramButtons } from "@/lib/telegramBot";

const TABLES = {
  revenue: { table: "revenue_requests", adminPath: "/admin/revenue-requests" },
  bonus: { table: "bonus_requests", adminPath: "/admin/bonus-requests" },
};

// Сотрудник сам отзывает свою ещё не рассмотренную заявку (ошибся в
// сумме, отправил дважды). Захватываем заявку условным обновлением —
// только если она всё ещё pending и его собственная: если админ успел
// нажать «Подтвердить», отозвать уже нельзя, и наоборот — кнопки в группе
// после отзыва ничего не сделают. Коины по pending-заявке ещё не
// начислялись, двигать их не нужно.
export async function withdrawMyRequest(kind, id) {
  const cfg = TABLES[kind];
  if (!cfg || !id) return { error: "Заявка не найдена" };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from(cfg.table)
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      admin_reply_comment: "Отозвана сотрудником",
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id, admin_chat_id, admin_message_id");

  if (error) return { error: "Не получилось отозвать, попробуй ещё раз" };
  if (!rows?.length) return { error: "Заявку уже рассмотрели — отозвать нельзя" };

  // В рабочей группе убираем кнопки и отвечаем на сообщение заявки, чтобы
  // админ не тратил на неё время. Сбой Телеграма отзыв не отменяет.
  const { admin_chat_id: chatId, admin_message_id: messageId } = rows[0];
  if (chatId && messageId) {
    try {
      await clearTelegramButtons(chatId, messageId);
      const threadId = process.env.TELEGRAM_REQUESTS_THREAD_ID
        ? Number(process.env.TELEGRAM_REQUESTS_THREAD_ID)
        : undefined;
      await sendTelegramMessage(
        chatId,
        "↩️ Сотрудник отозвал эту заявку — рассматривать не нужно.",
        undefined,
        threadId,
        messageId,
        { silent: true }
      );
    } catch (e) {
      console.error("[withdrawMyRequest] telegram", e);
    }
  }

  revalidatePath("/mop");
  revalidatePath("/mop/history");
  revalidatePath(cfg.adminPath);
  return { success: true };
}
