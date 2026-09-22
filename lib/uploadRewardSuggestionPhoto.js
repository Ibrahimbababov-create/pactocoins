"use client";

import { createClient } from "@/lib/supabase-browser";

const MAX_BYTES = 8 * 1024 * 1024; // 8 МБ

const EXT_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};
const OK_TYPES = new Set(Object.values(EXT_MIME));

function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return m ? m[1].toLowerCase() : "";
}

// Фото к своему предложению в магазин — грузим напрямую в Supabase Storage,
// как и в обучении, чтобы не упереться в лимит тела запроса Vercel.
export async function uploadRewardSuggestionPhoto(file) {
  if (!file || !file.size) return { error: "Файл не выбран" };
  if (file.size > MAX_BYTES) return { error: "Файл больше 8 МБ" };

  const ext = extOf(file.name);
  const contentType = OK_TYPES.has(file.type) ? file.type : EXT_MIME[ext];
  if (!contentType) return { error: "Можно загружать только фото" };

  const path = `${crypto.randomUUID()}.${ext || "jpg"}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("reward-suggestion-photos")
    .upload(path, file, { contentType, upsert: false });
  if (error) return { error: `Загрузка: ${error.message}` };

  const { data } = supabase.storage
    .from("reward-suggestion-photos")
    .getPublicUrl(path);
  return { url: data.publicUrl };
}
