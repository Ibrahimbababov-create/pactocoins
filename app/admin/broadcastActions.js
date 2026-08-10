"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendTelegramMessage, sendTelegramDocument } from "@/lib/telegramBot";

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

export async function broadcastMessage(formData) {
  await requireAdmin();

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

  const admin = createAdminClient();
  const { data: users } = await admin
    .from("users")
    .select("id, telegram_id")
    .not("telegram_id", "is", null);

  let sent = 0;
  let failed = 0;

  for (const u of users ?? []) {
    try {
      const res = hasFile
        ? await sendTelegramDocument(
            u.telegram_id,
            fileBytes,
            fileName,
            text || undefined,
            fileType
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

  return { sent, failed };
}
