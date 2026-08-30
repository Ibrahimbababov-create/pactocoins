"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramDocument,
} from "@/lib/telegramBot";
import { keepGroupMembers, isTeamMember } from "@/lib/teamGroup";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Не авторизован");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Доступ запрещён");

  return user;
}

async function parseBroadcastForm(formData) {
  const text = (formData.get("text")?.toString() || "").trim();
  const file = formData.get("file");
  const hasFile = file && typeof file === "object" && file.size > 0;

  if (!text && !hasFile) return { error: "Добавь текст или файл" };

  let fileBytes = null;
  let fileName = null;
  let fileType = null;

  if (hasFile) {
    fileBytes = Buffer.from(await file.arrayBuffer());
    fileName = file.name || "file";
    fileType = file.type || "application/octet-stream";
  }

  return { text, hasFile, fileBytes, fileName, fileType };
}

// Картинки шлём через sendPhoto (превью в чате), остальные файлы — sendDocument
function sendFile(chatId, { fileBytes, fileName, fileType }, caption) {
  if (fileType?.startsWith("image/")) {
    return sendTelegramPhoto(chatId, fileBytes, caption, fileType);
  }
  return sendTelegramDocument(chatId, fileBytes, fileName, caption, fileType);
}

export async function sendTestBroadcast(formData) {
  const admin_user = await requireAdmin();

  const parsed = await parseBroadcastForm(formData);
  if (parsed.error) return parsed;
  const { text, hasFile, fileBytes, fileName, fileType } = parsed;

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("telegram_id")
    .eq("id", admin_user.id)
    .single();

  if (!profile?.telegram_id) {
    return { error: "У твоего аккаунта нет telegram_id — зайди в приложение через бота хотя бы раз" };
  }

  try {
    const res = hasFile
      ? await sendFile(
          profile.telegram_id,
          { fileBytes, fileName, fileType },
          text || undefined
        )
      : await sendTelegramMessage(profile.telegram_id, text);

    if (!res?.ok) return { error: res?.description || "Telegram отклонил отправку" };
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function sendToEmployee(formData) {
  await requireAdmin();

  const userId = formData.get("userId")?.toString();
  if (!userId) return { error: "Выбери сотрудника" };

  const parsed = await parseBroadcastForm(formData);
  if (parsed.error) return parsed;
  const { text, hasFile, fileBytes, fileName, fileType } = parsed;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("name, telegram_id")
    .eq("id", userId)
    .single();

  if (!profile?.telegram_id) {
    return { error: "У этого сотрудника нет telegram_id — он ни разу не заходил через бота" };
  }

  if (!(await isTeamMember(profile.telegram_id))) {
    return {
      error: `${profile.name ?? "Этот человек"} не состоит в рабочей группе — сообщение не отправлено`,
    };
  }

  try {
    const res = hasFile
      ? await sendFile(
          profile.telegram_id,
          { fileBytes, fileName, fileType },
          text || undefined
        )
      : await sendTelegramMessage(profile.telegram_id, text);

    if (!res?.ok) return { error: res?.description || "Telegram отклонил отправку" };
    return { success: true, name: profile.name };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function broadcastMessage(formData) {
  await requireAdmin();

  const parsed = await parseBroadcastForm(formData);
  if (parsed.error) return parsed;
  const { text, hasFile, fileBytes, fileName, fileType } = parsed;

  const admin = createAdminClient();
  const { data: users } = await admin
    .from("users")
    .select("id, telegram_id")
    .not("telegram_id", "is", null)
    .eq("is_active", true)
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local");

  // Оставляем только тех, кто реально в рабочей группе — остальные
  // (случайно открывшие бота, наблюдатели вне группы и т.п.) не получают.
  const inGroup = await keepGroupMembers((users ?? []).map((u) => u.telegram_id));
  const recipients = (users ?? []).filter((u) =>
    inGroup.has(String(u.telegram_id))
  );
  const skipped = (users?.length ?? 0) - recipients.length;

  let sent = 0;
  let failed = 0;

  for (const u of recipients) {
    try {
      const res = hasFile
        ? await sendFile(
            u.telegram_id,
            { fileBytes, fileName, fileType },
            text || undefined
          )
        : await sendTelegramMessage(u.telegram_id, text);

      if (res?.ok) {
        sent++;
      } else {
        failed++;
        console.error(`[broadcast] failed for user ${u.id}:`, res);
      }
    } catch (err) {
      failed++;
      console.error(`[broadcast] error for user ${u.id}:`, err);
    }
  }

  return { sent, failed, skipped };
}
