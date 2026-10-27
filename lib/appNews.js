// Новости приложения. Таблицы app_news и app_news_reads создаёт
// supabase/app_news.sql; пока их нет, всё здесь тихо возвращает «новостей нет».

export const NEWS_TITLE_MAX = 80;
export const NEWS_BODY_MAX = 1000;
export const NEWS_ROLES = ["mop", "rop", "mentor", "trainee"];

// Таблицы ещё не созданы в базе
export function isMissingNewsTable(error) {
  if (!error) return false;
  const msg = String(error.message ?? "");
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (/app_news/.test(msg) && /(does not exist|schema cache|not find)/i.test(msg))
  );
}

// Колонки expires_at ещё нет в базе (supabase/app_news_expires.sql не применён)
export function isMissingExpiresColumn(error) {
  if (!error) return false;
  return /expires_at/.test(String(error.message ?? ""));
}

// Срок вышел? Нет срока = не вышел.
export function isNewsExpired(expiresAt) {
  return Boolean(expiresAt) && new Date(expiresAt).getTime() <= Date.now();
}

// Конец выбранного дня по Алматы, ISO для timestamptz. Пусто = без срока.
export function expiresDayToIso(day) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day ?? "") ? new Date(`${day}T23:59:59+05:00`).toISOString() : null;
}

// Первая непустая строка текста, для превью на карточке
export function firstLine(body = "") {
  const line = String(body)
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  return line ?? "";
}

// Опубликованные новости и отметки «прочитано» этого человека.
// Читаем сервисным ключом, чтобы админ в режиме просмотра видел то же, что
// человек; наружу уходит только то, что и так видно сотруднику.
export async function loadNewsFor(admin, userId, limit = 30) {
  try {
    const query = (cols) =>
      admin
        .from("app_news")
        .select(cols)
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(limit);
    let { data: news, error } = await query("id, title, body, important, published_at, expires_at");
    // Колонки срока ещё нет: читаем без неё, срока ни у кого нет
    if (isMissingExpiresColumn(error)) {
      ({ data: news, error } = await query("id, title, body, important, published_at"));
    }
    if (error || !news?.length) return [];

    const { data: reads } = await admin
      .from("app_news_reads")
      .select("news_id")
      .eq("user_id", userId)
      .in(
        "news_id",
        news.map((n) => n.id)
      );
    const readIds = new Set((reads ?? []).map((r) => r.news_id));
    return news.map((n) => ({ ...n, unread: !readIds.has(n.id), expired: isNewsExpired(n.expires_at) }));
  } catch {
    return [];
  }
}
