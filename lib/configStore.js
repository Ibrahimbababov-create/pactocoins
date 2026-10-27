// Маленькие настройки-файлы (JSON) в закрытом бакете Supabase Storage
// app-config. Схему базы не трогают.
//
// Почему не обычный download/upload: после перезаписи файла обычное
// скачивание иногда отдаёт старую копию из кэша, и сохранённая настройка
// выглядела несохранённой («жму по много раз»). Поэтому читаем по свежей
// подписанной ссылке с меткой времени без кэша, а пишем с cacheControl "0".
// Все настройки читать и писать только через этот файл.

export const CONFIG_BUCKET = "app-config";

const NOT_FOUND = Symbol("not-found");

async function readStrict(admin, path) {
  const { data, error } = await admin.storage.from(CONFIG_BUCKET).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    if (!error || /not.?found|does not exist/i.test(error.message ?? "")) return NOT_FOUND;
    throw new Error(error.message);
  }
  const sep = data.signedUrl.includes("?") ? "&" : "?";
  const res = await fetch(`${data.signedUrl}${sep}t=${Date.now()}`, { cache: "no-store" });
  if (res.status === 400 || res.status === 404) return NOT_FOUND;
  if (!res.ok) throw new Error(`Не удалось прочитать ${path}: ${res.status}`);
  return JSON.parse(await res.text());
}

// Файла нет или не прочитался: возвращаем fallback, ничего не падает.
export async function readConfigJson(admin, path, fallback = null) {
  try {
    const v = await readStrict(admin, path);
    return v === NOT_FOUND ? fallback : v;
  } catch {
    return fallback;
  }
}

async function ensureBucket(admin) {
  const { data: buckets } = await admin.storage.listBuckets();
  if ((buckets ?? []).some((b) => b.id === CONFIG_BUCKET)) return null;
  const { error } = await admin.storage.createBucket(CONFIG_BUCKET, { public: false });
  return error && !/exists/i.test(error.message) ? error.message : null;
}

// { ok: true } или { error }.
export async function writeConfigJson(admin, path, obj) {
  const bucketError = await ensureBucket(admin);
  if (bucketError) return { error: bucketError };
  const { error } = await admin.storage
    .from(CONFIG_BUCKET)
    .upload(path, JSON.stringify(obj, null, 2), {
      contentType: "application/json",
      upsert: true,
      cacheControl: "0",
    });
  return error ? { error: error.message } : { ok: true };
}

// «Прочитать, изменить, записать». mutator(текущее | null) возвращает новое
// содержимое. Если файл есть, но прочитать не удалось, не пишем: иначе
// сбой чтения стёр бы настройки.
export async function updateConfigJson(admin, path, mutator) {
  let current;
  try {
    current = await readStrict(admin, path);
  } catch (e) {
    return { error: e.message };
  }
  const next = await mutator(current === NOT_FOUND ? null : current);
  return writeConfigJson(admin, path, next);
}
