"use client";

import { useEffect, useState } from "react";

// Компактная плашка с балансом, выезжает сверху когда основную карточку
// баланса уже увёл за экран прокруткой.
export default function StickyBalance({ balance }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 230);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 top-0 z-40 border-b border-dark-600 bg-dark-900/90 backdrop-blur transition-transform duration-200 ${
        shown ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center justify-between">
        <span className="font-black text-sm">
          Pacto<span className="text-acid-400">Coins</span>
        </span>
        <span className="text-sm">
          <span className="text-gray-500">баланс </span>
          <span className="font-black text-acid-400 tabular-nums">
            {Number(balance).toLocaleString("ru-RU")}
          </span>
        </span>
      </div>
    </div>
  );
}
