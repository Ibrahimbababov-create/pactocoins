"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/mop", label: "Баланс", icon: "◆" },
  { href: "/mop/rating", label: "Рейтинг", icon: "▲" },
  { href: "/mop/history", label: "История", icon: "≡" },
  { href: "/mop/shop", label: "Магазин", icon: "★" },
  { href: "/mop/purchases", label: "Покупки", icon: "◈" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-dark-600 z-50">
      <div className="max-w-lg mx-auto grid grid-cols-5">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-2.5 gap-1 text-xs ${
                active ? "text-acid-400" : "text-gray-500"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
