"use client";

import { useEffect, useState } from "react";

// Постоянная верхняя панель: логотип слева, баланс справа проявляется,
// когда основную карточку баланса увели за экран (навигация теперь
// вся внизу — в нижнем меню, бокового меню больше нет).
export default function MopTopBar({ balance }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 210);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 border-b border-dark-600/40 bg-dark-900/85 backdrop-blur">
        <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between gap-3">
          <span className="font-black text-sm font-display">
            Pacto<span className="text-acid-400">Coins</span>
          </span>
          {scrolled && (
            <span className="text-sm">
              <span className="text-gray-500">баланс </span>
              <span className="font-black text-acid-400 tabular-nums">
                {Number(balance).toLocaleString("ru-RU")}
              </span>
            </span>
          )}
        </div>
      </div>
      <div className="h-12" />
    </>
  );
}
