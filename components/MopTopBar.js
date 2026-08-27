"use client";

import { useEffect, useState } from "react";
import SideMenu from "@/components/SideMenu";

// Постоянная верхняя панель: слева логотип, справа кнопка «Меню»
// (всегда доступна, даже при прокрутке вниз). Баланс проявляется,
// когда основную карточку баланса увели за экран.
export default function MopTopBar({ balance, unreadCount = 0 }) {
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
          <span className="font-black text-sm">
            Pacto<span className="text-acid-400">Coins</span>
          </span>
          <div className="flex items-center gap-3">
            <span
              className={`text-sm transition-opacity duration-200 ${
                scrolled ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <span className="text-gray-500">баланс </span>
              <span className="font-black text-acid-400 tabular-nums">
                {Number(balance).toLocaleString("ru-RU")}
              </span>
            </span>
            <SideMenu unreadCount={unreadCount} />
          </div>
        </div>
      </div>
      <div className="h-12" />
    </>
  );
}
