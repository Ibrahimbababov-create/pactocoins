"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Обзор" },
  { href: "/admin/rating", label: "Рейтинг" },
  { href: "/admin/employees", label: "Сотрудники" },
  { href: "/admin/join-requests", label: "Заявки на регистрацию" },
  { href: "/admin/revenue-requests", label: "Заявки на выручку" },
  { href: "/admin/bonus-requests", label: "Бонусы" },
  { href: "/admin/purchase-requests", label: "Заявки на покупки" },
  { href: "/admin/budget", label: "Бюджет" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="max-w-6xl mx-auto px-4 overflow-x-auto">
      <div className="flex gap-1 pb-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm ${
                active
                  ? "bg-acid-400/10 text-acid-400 font-semibold"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
