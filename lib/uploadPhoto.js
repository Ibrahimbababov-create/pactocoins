const MAX_BYTES = 3 * 1024 * 1024; // 3 МБ — с запасом, клиент обычно уже сжимает

// Загружает фото в указанный public storage-бакет через service-role
// клиент. Возвращает { url } при успехе (url === null, если фото не
// передали — это ок, поле необязательное), либо { error }.
export async function uploadPhoto(admin, bucket, photo) {
  const hasPhoto = photo && typeof photo === "object" && photo.size > 0;
  if (!hasPhoto) return { url: null };

  if (photo.size > MAX_BYTES) {
    return { error: "Фото слишком большое (максимум 3 МБ)" };
  }
  if (!photo.type || !photo.type.startsWith("image/")) {
    return { error: "Можно загружать только изображения" };
  }

  const bytes = Buffer.from(await photo.arrayBuffer());
  const ext = (photo.name?.split(".").pop() || "jpg").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from(bucket)
    .upload(path, bytes, { contentType: photo.type });

  if (uploadError) return { error: `Фото: ${uploadError.message}` };

  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl };
}
