"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { haptic } from "@/lib/haptics";
import Icon from "@/components/Icon";

const DEFAULT_ITEMS = [
  { href: "/mop", label: "Баланс", icon: "home", exact: true },
  { href: "/mop/rating", label: "Рейтинг", icon: "chart" },
  { href: "/mop/shop", label: "Магазин", icon: "bag" },
  { href: "/mop/games", label: "Игры", icon: "wheel" },
  { href: "/mop/more", label: "Ещё", icon: "dots" },
];

const ROP_ITEMS = [
  { href: "/mop", label: "Баланс", icon: "home", exact: true },
  { href: "/mop/team", label: "Команда", icon: "users" },
  { href: "/mop/rating", label: "Рейтинг", icon: "chart" },
  { href: "/mop/shop", label: "Магазин", icon: "bag" },
  { href: "/mop/more", label: "Ещё", icon: "dots" },
];

const MENTOR_ITEMS = [
  { href: "/mop", label: "Баланс", icon: "home", exact: true },
  { href: "/mop/trainees", label: "Стажёры", icon: "users" },
  { href: "/mop/rating", label: "Рейтинг", icon: "chart" },
  { href: "/mop/shop", label: "Магазин", icon: "bag" },
  { href: "/mop/more", label: "Ещё", icon: "dots" },
];

const TRAINEE_ITEMS = [
  { href: "/mop", label: "Обучение", icon: "sparkle", exact: true },
  { href: "/mop/materials", label: "Регламенты", icon: "help" },
  { href: "/mop/more", label: "Ещё", icon: "dots" },
];

export default function BottomNav({ role, unreadCount = 0 }) {
  const pathname = usePathname();
  const items =
    role === "rop"
      ? ROP_ITEMS
      : role === "mentor"
      ? MENTOR_ITEMS
      : role === "trainee"
      ? TRAINEE_ITEMS
      : DEFAULT_ITEMS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-dark-600 z-50">
      <div
        className="max-w-lg mx-auto grid pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => haptic.light()}
              className={`relative flex flex-col items-center justify-center py-2.5 gap-1 text-[11px] transition-colors active:scale-95 ${
                active ? "text-acid-400" : "text-gray-500"
              }`}
            >
              <span className="relative">
                <Icon
                  name={item.icon}
                  className="w-[22px] h-[22px]"
                  strokeWidth={active ? 2 : 1.75}
                />
                {item.href === "/mop/more" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 bg-acid-400 text-black text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
