"use client";

import { useState } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import Icon from "@/components/Icon";

const ITEMS = [
  { href: "/admin/rewards", label: "Магазин наград", icon: "bag" },
  { href: "/admin/funds", label: "Копилки", icon: "piggy" },
  { href: "/admin/broadcast", label: "Рассылка", icon: "megaphone" },
  { href: "/admin/merge-accounts", label: "Слияние аккаунтов", icon: "link" },
  { href: "/levels", label: "Звания", icon: "award" },
  { href: "/messages", label: "Сообщения", icon: "mail", badgeKey: "unreadMessages" },
  {
    href: "/admin/bot-messages",
    label: "Сообщения боту",
    icon: "bot",
    badgeKey: "unreadBotMessages",
  },
];

export default function AdminSideMenu({ unreadMessages = 0, unreadBotMessages = 0 }) {
  const [open, setOpen] = useState(false);
  const totalUnread = unreadMessages + unreadBotMessages;
  const badges = { unreadMessages, unreadBotMessages };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Меню"
        className="relative flex items-center gap-1.5 text-gray-300 text-sm p-1"
      >
        <Icon name="menu" className="w-5 h-5" />
        Меню
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-acid-400 text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-0 right-0 h-full w-64 bg-dark-800 border-l border-dark-600 p-4 space-y-1">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold">Меню</p>
              <button
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="text-gray-500 p-1"
              >
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>

            {ITEMS.map((item) => {
              const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-dark-700 transition"
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      name={item.icon}
                      className="w-5 h-5 shrink-0 text-gray-400"
                    />
                    {item.label}
                  </span>
                  {badgeCount > 0 && (
                    <span className="bg-acid-400 text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}

            <div className="pt-2 mt-2 border-t border-dark-600 px-3">
              <LogoutButton />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
