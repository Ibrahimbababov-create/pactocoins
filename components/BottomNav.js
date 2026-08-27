"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { haptic } from "@/lib/haptics";

const items = [
  { href: "/mop", label: "Баланс", icon: "◆" },
  { href: "/mop/rating", label: "Рейтинг", icon: "▲" },
  { href: "/mop/history", label: "История", icon: "≡" },
  { href: "/mop/shop", label: "Магазин", icon: "★" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-dark-600 z-50">
      <div className="max-w-lg mx-auto grid grid-cols-4">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => haptic.light()}
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
