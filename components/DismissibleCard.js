"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";

// Карточка с крестиком справа: закрыл — на этом устройстве больше не
// показываем (как объявление на главной).
export default function DismissibleCard({ storageKey, children }) {
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(`dismiss_${storageKey}`) === "1") setHidden(true);
    } catch {
      /* приватный режим — просто покажем */
    }
  }, [storageKey]);

  if (!mounted || hidden) return null;

  return (
    <div className="relative">
      {children}
      <button
        type="button"
        aria-label="Скрыть"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(`dismiss_${storageKey}`, "1");
          } catch {
            /* не критично */
          }
        }}
        className="absolute top-1/2 -translate-y-1/2 right-1.5 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-300"
      >
        <Icon name="x" className="w-4 h-4" />
      </button>
    </div>
  );
}
