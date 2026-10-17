"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";

// Объявление вверху дашборда / в магазине. На дашборде его можно закрыть
// крестиком (запоминаем в localStorage по key), в магазине оно висит всегда.
export default function AnnouncementBanner({
  storageKey = "announcement",
  dismissible = true,
  icon = "megaphone",
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

  // Небольшая плашка в цвет темы: иконка, заголовок, строка текста, крестик.
  const body = (
    <div className="relative flex items-center gap-3 rounded-2xl border border-acid-400/30 bg-gradient-to-r from-acid-400/10 to-dark-800 py-3 pl-3 pr-10">
      <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-xl bg-acid-400/15 text-acid-400">
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-tight">{title}</span>
        <span className="block text-xs text-gray-400 mt-0.5 leading-snug">{text}</span>
      </span>

      {dismissible && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dismiss();
          }}
          aria-label="Скрыть объявление"
          className="absolute top-1/2 -translate-y-1/2 right-1.5 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-300"
        >
          <Icon name="x" className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block active:opacity-80 transition">
        {body}
      </Link>
    );
  }
  return body;
}
