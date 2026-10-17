"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";

// Карточка с крестиком справа: закрыл — на этом устройстве больше не
// показываем (как объявление на главной).
//
// С label — другой вид: карточка рисуется сразу (className — её рамка), а
// внизу внутри неё текстовая кнопка, например «Скрыть». Так у
// тех, кто ничего не скрывал, ничего не прыгает при загрузке.
export default function DismissibleCard({ storageKey, children, label = null, className = "" }) {
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const key = `dismiss_${storageKey}`;

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(key) === "1") setHidden(true);
    } catch {
      /* приватный режим — просто покажем */
    }
  }, [key]);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* не критично */
    }
  };

  if (label) {
    if (hidden) return null;
    return (
      <div className={className}>
        {children}
        <button
          type="button"
          onClick={dismiss}
          className="block w-full text-center text-xs text-gray-500 hover:text-gray-300 pt-0.5"
        >
          {label}
        </button>
      </div>
    );
  }

  if (!mounted || hidden) return null;

  return (
    <div className="relative">
      {children}
      <button
        type="button"
        aria-label="Скрыть"
        onClick={dismiss}
        className="absolute top-1/2 -translate-y-1/2 right-1.5 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-300"
      >
        <Icon name="x" className="w-4 h-4" />
      </button>
    </div>
  );
}
