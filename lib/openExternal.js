"use client";

// Открыть внешнюю ссылку из Mini App. Внутри Telegram — через нативный
// openLink (с Instant View для telegra.ph и подобных), иначе обычная вкладка.
export function openExternal(url) {
  if (!url) return;
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
  if (tg?.openLink) {
    try {
      tg.openLink(url, { try_instant_view: true });
      return;
    } catch {}
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
