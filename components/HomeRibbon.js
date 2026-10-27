"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";

// Тонкая лента над балансом («У тебя 3 крутки»). Крестик прячет её на этом
// устройстве: запоминаем число level (например, сколько было круток), и лента
// возвращается, только когда оно выросло. Хранилище может быть недоступно
// (приватный режим) — тогда просто показываем ленту.
const keyOf = (id) => `ribbon_hidden_${id}`;

export default function HomeRibbon({ id, level = 1, href, icon, text }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(keyOf(id)));
      if (Number.isFinite(saved) && saved > 0 && level <= saved) setHidden(true);
    } catch {
      /* без хранилища — покажем */
    }
  }, [id, level]);

  if (hidden) return null;

  function hide() {
    setHidden(true);
    try {
      localStorage.setItem(keyOf(id), String(level));
    } catch {
      /* не критично */
    }
  }

  return (
    <div className="flex items-center rounded-xl border border-acid-400/30 bg-acid-400/[0.07]">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-3.5 active:opacity-70">
        <Icon name={icon} className="w-5 h-5 text-acid-400 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-acid-400">{text}</span>
        <Icon name="chevronRight" className="w-4 h-4 text-gray-600 shrink-0" />
      </Link>
      <button
        type="button"
        onClick={hide}
        aria-label="Скрыть"
        title="Скрыть"
        className="flex h-10 w-10 shrink-0 items-center justify-center text-gray-500 active:text-gray-300"
      >
        <Icon name="x" className="w-4 h-4" />
      </button>
    </div>
  );
}
