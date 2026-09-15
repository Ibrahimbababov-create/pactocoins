"use client";

import { createClient } from "@/lib/supabase-browser";

const MAX_BYTES = 20 * 1024 * 1024; // 20 МБ

const EXT_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const OK_TYPES = new Set(Object.values(EXT_MIME));

function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return m ? m[1].toLowerCase() : "";
}

// Грузит файл напрямую в Supabase Storage (браузер → Supabase, минуя
// Vercel и его лимит тела). Возвращает { url, name } или { error }.
// Тип определяем и по MIME, и по расширению — телефонные пикеры иногда
// не проставляют MIME для .doc/.docx.
export async function uploadOnboardingFile(file) {
  if (!file || !file.size) return { error: "Файл не выбран" };
  if (file.size > MAX_BYTES) return { error: "Файл больше 20 МБ" };

  const ext = extOf(file.name);
  const contentType = OK_TYPES.has(file.type) ? file.type : EXT_MIME[ext];
  if (!contentType) {
    return { error: "Можно загружать фото, PDF или Word-документ (.doc/.docx)" };
  }

  const path = `${crypto.randomUUID()}.${ext || "bin"}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("onboarding-files")
    .upload(path, file, { contentType, upsert: false });
  if (error) return { error: `Загрузка: ${error.message}` };

  const { data } = supabase.storage.from("onboarding-files").getPublicUrl(path);
  return { url: data.publicUrl, name: file.name || "файл" };
}
