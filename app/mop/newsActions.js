"use server";

import { createClient } from "@/lib/supabase-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Отметить новости прочитанными. Пишем от имени самого человека: права
// в базе разрешают вставлять только свои отметки.
export async function markNewsRead(ids) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const list = [...new Set((Array.isArray(ids) ? ids : [ids]).filter((i) => UUID.test(String(i))))].slice(0, 50);
  if (!list.length) return { ok: true };

  const { error } = await supabase
    .from("app_news_reads")
    .upsert(
      list.map((news_id) => ({ user_id: user.id, news_id })),
      { onConflict: "user_id,news_id", ignoreDuplicates: true }
    );
  if (error) return { error: "Не удалось отметить" };
  return { ok: true };
}
