"use client";

import { useEffect, useState } from "react";

// Объявление вверху дашборда / в магазине. На дашборде его можно закрыть
// крестиком (запоминаем в localStorage по key), в магазине оно висит всегда.
export default function AnnouncementBanner({
  storageKey = "announcement",
  dismissible = true,
  title,
  text,
  href,
}) {
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!dismissible) return;
    try {
      if (localStorage.getItem(`dismiss_${storageKey}`) === "1") setHidden(true);
    } catch {
      /* приватный режим — просто покажем */
    }
  }, [dismissible, storageKey]);

  if (!mounted || hidden) return null;

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(`dismiss_${storageKey}`, "1");
    } catch {
      /* не критично */
    }
  }

  const body = (
    <div className="relative bg-gradient-to-br from-sky-500/10 to-dark-800 border border-sky-500/30 rounded-2xl p-4">
      <p className="font-bold text-sky-300 pr-6">{title}</p>
      <p className="text-sm text-gray-400 mt-1">{text}</p>

      {dismissible && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            dismiss();
          }}
          aria-label="Скрыть объявление"
          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-300 text-lg leading-none"
        >
          ×
        </button>
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {body}
      </a>
    );
  }
  return body;
}
