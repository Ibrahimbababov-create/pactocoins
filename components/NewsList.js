"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import NewsText from "@/components/NewsText";
import { markNewsRead } from "@/app/mop/newsActions";
import { firstLine } from "@/lib/appNews";

// Список новостей: тап раскрывает карточку и отмечает её прочитанной.
// readOnly (админ смотрит чужими глазами) ничего не отмечает.
export default function NewsList({ items, readOnly = false }) {
  const router = useRouter();
  const [openId, setOpenId] = useState(null);
  const [read, setRead] = useState(() => new Set(items.filter((n) => !n.unread).map((n) => n.id)));

  const toggle = async (n) => {
    const opening = openId !== n.id;
    setOpenId(opening ? n.id : null);
    if (!opening || readOnly || read.has(n.id)) return;
    setRead((s) => new Set(s).add(n.id));
    try {
      const res = await markNewsRead([n.id]);
      if (res?.error) throw new Error(res.error);
      router.refresh();
    } catch {
      // Не вышло отметить: вернём точку, откроется снова при следующем тапе
      setRead((s) => {
        const next = new Set(s);
        next.delete(n.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-3">
      {items.map((n) => {
        const isUnread = !read.has(n.id);
        const open = openId === n.id;
        return (
          <div
            key={n.id}
            className={`rounded-2xl border bg-dark-800 ${
              isUnread ? "border-acid-400/40" : "border-dark-700"
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(n)}
              aria-expanded={open}
              className="w-full flex items-start gap-3 p-4 text-left active:opacity-80"
            >
              <span
                className={`mt-2 w-2 h-2 shrink-0 rounded-full ${isUnread ? "bg-acid-400" : "bg-transparent"}`}
                aria-label={isUnread ? "Не прочитано" : undefined}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-gray-500">
                  {n.when}
                  {n.important ? " · важная" : ""}
                </span>
                <span className="block font-display font-bold leading-snug break-words">{n.title}</span>
                {!open && (
                  <span className="block text-sm text-gray-400 mt-1 truncate">{firstLine(n.body)}</span>
                )}
              </span>
              <Icon
                name={open ? "chevronDown" : "chevronRight"}
                className="w-4 h-4 mt-1.5 shrink-0 text-gray-600"
              />
            </button>
            {open && (
              <div className="px-4 pb-4 pl-9">
                <NewsText text={n.body} className="text-sm text-gray-300 leading-relaxed" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
