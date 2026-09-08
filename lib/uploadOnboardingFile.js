"use client";

import { createClient } from "@/lib/supabase-browser";

const MAX_BYTES = 20 * 1024 * 1024; // 20 МБ
const OK_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "application/pdf",
];

// Грузит файл напрямую в Supabase Storage (браузер → Supabase, минуя
// Vercel и его лимит тела). Возвращает { url, name } или { error }.
export async function uploadOnboardingFile(file) {
  if (!file || !file.size) return { error: "Файл не выбран" };
  if (file.size > MAX_BYTES) return { error: "Файл больше 20 МБ" };
  if (!OK_TYPES.includes(file.type)) {
    return { error: "Можно загружать фото или PDF" };
  }

  const ext = (file.name?.split(".").pop() || "bin").toLowerCase().slice(0, 8);
  const path = `${crypto.randomUUID()}.${ext}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("onboarding-files")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: `Загрузка: ${error.message}` };

  const { data } = supabase.storage.from("onboarding-files").getPublicUrl(path);
  return { url: data.publicUrl, name: file.name || "файл" };
}
