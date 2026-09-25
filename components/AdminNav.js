"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Шесть разделов вместо десяти вкладок вперемешку. Очереди заявок,
// люди, магазин и деньги — это по одному разделу с подвкладками внутри
// (AdminSubNav), а не по четыре пункта наверху.
const SECTIONS = [
  { href: "/admin", label: "Обзор", exact: true },
  {
    href: "/admin/revenue-requests",
    label: "Заявки",
    owns: [
      "/admin/revenue-requests",
      "/admin/bonus-requests",
      "/admin/purchase-requests",
      "/admin/join-requests",
    ],
    badgeKey: "pendingRequests",
  },
  {
    href: "/admin/employees",
    label: "Люди",
    owns: [
      "/admin/employees",
      "/admin/rating",
      "/admin/projects",
      "/admin/merge-accounts",
    ],
  },
  {
    href: "/admin/rewards",
    label: "Магазин",
    owns: ["/admin/rewards", "/admin/reward-suggestions"],
    badgeKey: "pendingSuggestions",
  },
  {
    href: "/admin/budget",
    label: "Деньги",
    owns: ["/admin/budget", "/admin/funds"],
  },
  { href: "/admin/onboarding", label: "Обучение", owns: ["/admin/onboarding"] },
];

export default function AdminNav({
  pendingRequests = 0,
  pendingSuggestions = 0,
  onlyOnboarding = false,
}) {
  const pathname = usePathname();
  const badges = { pendingRequests, pendingSuggestions };
  const sections = onlyOnboarding
    ? SECTIONS.filter((x) => x.href === "/admin/onboarding")
    : SECTIONS;

  return (
    <div className="max-w-6xl mx-auto px-4 overflow-x-auto no-scrollbar">
      <div className="flex gap-1 pb-2">
        {sections.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : (item.owns ?? []).some((p) => pathname.startsWith(p));
          const badge = item.badgeKey ? badges[item.badgeKey] : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                active
                  ? "bg-acid-400/10 text-acid-400 font-semibold"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {item.label}
              {badge > 0 && (
                <span className="bg-acid-400 text-black text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
