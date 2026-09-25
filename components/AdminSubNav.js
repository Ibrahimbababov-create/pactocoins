"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Подвкладки раздела. Сам решает, что показать, по текущему адресу —
// поэтому страницам ничего передавать не нужно, он живёт в разметке
// админки один раз.
const GROUPS = [
  {
    match: [
      "/admin/revenue-requests",
      "/admin/bonus-requests",
      "/admin/purchase-requests",
      "/admin/join-requests",
    ],
    items: [
      { href: "/admin/revenue-requests", label: "Выручка", badgeKey: "revenue" },
      { href: "/admin/bonus-requests", label: "Бонусы", badgeKey: "bonus" },
      { href: "/admin/purchase-requests", label: "Покупки", badgeKey: "purchase" },
      { href: "/admin/join-requests", label: "Новые люди", badgeKey: "join" },
    ],
  },
  {
    match: [
      "/admin/employees",
      "/admin/rating",
      "/admin/projects",
      "/admin/merge-accounts",
    ],
    items: [
      { href: "/admin/employees", label: "Сотрудники" },
      { href: "/admin/projects", label: "Проекты" },
      { href: "/admin/rating", label: "Рейтинг" },
      { href: "/admin/merge-accounts", label: "Объединить аккаунты" },
    ],
  },
  {
    match: ["/admin/rewards", "/admin/reward-suggestions"],
    items: [
      { href: "/admin/rewards", label: "Награды" },
      {
        href: "/admin/reward-suggestions",
        label: "Что предлагают",
        badgeKey: "suggestions",
      },
    ],
  },
  {
    match: ["/admin/budget", "/admin/funds"],
    items: [
      { href: "/admin/budget", label: "Бюджет" },
      { href: "/admin/funds", label: "Копилки" },
    ],
  },
];

export default function AdminSubNav({ counts = {} }) {
  const pathname = usePathname();
  const group = GROUPS.find((g) => g.match.some((p) => pathname.startsWith(p)));
  if (!group) return null;

  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar -mt-1 mb-4">
      {group.items.map((item) => {
        const active = pathname.startsWith(item.href);
        const badge = item.badgeKey ? counts[item.badgeKey] ?? 0 : 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 border ${
              active
                ? "border-dark-600 bg-dark-800 text-ink font-semibold"
                : "border-transparent text-gray-500 hover:text-white"
            }`}
          >
            {item.label}
            {badge > 0 && (
              <span
                className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ${
                  active ? "bg-acid-400 text-black" : "bg-dark-700 text-gray-300"
                }`}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
