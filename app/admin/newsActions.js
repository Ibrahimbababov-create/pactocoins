"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendTelegramMessage } from "@/lib/telegramBot";
import { escapeHtml } from "@/lib/notifyUser";
import {
  NEWS_TITLE_MAX,
  NEWS_BODY_MAX,
  isMissingNewsTable,
  isMissingExpiresColumn,
  expiresDayToIso,
} from "@/lib/appNews";

const NO_TABLE = "Новости ещё не включены: нужно применить supabase/app_news.sql";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: "Доступ запрещён" };
  return { user };
}

function refresh() {
  revalidatePath("/admin/news");
  revalidatePath("/mop");
  revalidatePath("/mop/news");
  revalidatePath("/mop/more");
}

// Сообщение в анонс-тему группы: тихое, с экранированным текстом.
// Сбой отправки не отменяет публикацию, ошибку вернём админу.
async function sendToGroup(title, body) {
  const chat = process.env.TELEGRAM_ANNOUNCE_CHAT_ID;
  if (!chat) return "Не задана группа для анонсов (TELEGRAM_ANNOUNCE_CHAT_ID)";
  const thread = process.env.TELEGRAM_ANNOUNCE_THREAD_ID
    ? Number(process.env.TELEGRAM_ANNOUNCE_THREAD_ID)
    : undefined;
  const text = `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(body)}`;
  try {
    const res = await sendTelegramMessage(chat, text, undefined, thread, undefined, { silent: true });
    if (!res?.ok) return res?.description ?? "Telegram не принял сообщение";
    return null;
  } catch (err) {
    return err?.message ?? "Не удалось отправить в Telegram";
  }
}

// Создать или обновить новость. mode: "publish" | "draft".
// В группу пишем только при публикации новости, которая раньше не была
// опубликована, и только если стоит галочка.
export async function saveNews({ id, title, body, important, mode, toGroup, expires }) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const t = String(title ?? "").trim();
  const b = String(body ?? "").replace(/\r\n/g, "\n").trim();
  if (!t) return { error: "Напиши заголовок" };
  if (t.length > NEWS_TITLE_MAX) return { error: `Заголовок длиннее ${NEWS_TITLE_MAX} знаков` };
  if (!b) return { error: "Напиши текст новости" };
  if (b.length > NEWS_BODY_MAX) return { error: `Текст длиннее ${NEWS_BODY_MAX} знаков` };

  const expiresIso = expiresDayToIso(expires);
  const publish = mode === "publish";
  const admin = createAdminClient();
  let wasPublished = false;

  if (id) {
    const { data: old, error: findErr } = await admin
      .from("app_news")
      .select("id, is_published")
      .eq("id", id)
      .maybeSingle();
    if (findErr) return { error: isMissingNewsTable(findErr) ? NO_TABLE : findErr.message };
    if (!old) return { error: "Новость не найдена" };
    wasPublished = old.is_published;

    const patch = { title: t, body: b, important: Boolean(important) };
    // Черновик, который публикуем впервые, получает дату публикации «сейчас»
    if (publish && !wasPublished) {
      patch.is_published = true;
      patch.published_at = new Date().toISOString();
    }
    // Сохранение как черновик снимает новость с публикации
    if (!publish) patch.is_published = false;

    let { error } = await admin.from("app_news").update({ ...patch, expires_at: expiresIso }).eq("id", id);
    // Колонки срока ещё нет: сохраняем остальное, срок пока не действует
    if (isMissingExpiresColumn(error)) ({ error } = await admin.from("app_news").update(patch).eq("id", id));
    if (error) return { error: isMissingNewsTable(error) ? NO_TABLE : error.message };
  } else {
    const row = {
      title: t,
      body: b,
      important: Boolean(important),
      is_published: publish,
      published_at: new Date().toISOString(),
      created_by: auth.user.id,
    };
    let { error } = await admin.from("app_news").insert({ ...row, expires_at: expiresIso });
    if (isMissingExpiresColumn(error)) ({ error } = await admin.from("app_news").insert(row));
    if (error) return { error: isMissingNewsTable(error) ? NO_TABLE : error.message };
  }

  let groupError = null;
  const sendNow = publish && !wasPublished && Boolean(toGroup);
  if (sendNow) groupError = await sendToGroup(t, b);

  refresh();
  return { ok: true, sentToGroup: sendNow && !groupError, groupError };
}

// Снять новость с публикации или вернуть. В Telegram ничего не уходит.
export async function setNewsPublished(id, published) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };
  const patch = published
    ? { is_published: true, published_at: new Date().toISOString() }
    : { is_published: false };
  const { error } = await createAdminClient().from("app_news").update(patch).eq("id", id);
  if (error) return { error: isMissingNewsTable(error) ? NO_TABLE : error.message };
  refresh();
  return { ok: true };
}
