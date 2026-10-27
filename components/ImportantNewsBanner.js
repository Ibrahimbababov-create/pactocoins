"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { firstLine } from "@/lib/appNews";
import { markNewsRead } from "@/app/mop/newsActions";

// Плашка вверху главной про важное. Без принуждения: закрывается крестиком
// (это же считается «прочитано»), по нажатию открывает раздел «Что важно».
export default function ImportantNewsBanner({ items }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  if (hidden || !items?.length) return null;
  const n = items[0];

  const dismiss = async () => {
    setHidden(true);
    try {
      await markNewsRead(items.map((i) => i.id));
      router.refresh();
    } catch {
      /* не критично: плашка просто покажется снова */
    }
  };

  return (
    <div className="relative flex items-center gap-3 rounded-2xl border border-acid-400/40 bg-gradient-to-r from-acid-400/10 to-dark-800 py-3 pl-3 pr-10">
      <Link href="/mop/news" className="flex items-center gap-3 min-w-0 flex-1 active:opacity-80 transition">
        <span className="flex items-center justify-center w-9 h-9 shrink-0 rounded-xl bg-acid-400/15 text-acid-400">
          <Icon name="megaphone" className="w-5 h-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs text-acid-400">
            Важно{items.length > 1 ? ` · ещё ${items.length - 1}` : ""}
          </span>
          <span className="block text-sm font-bold leading-tight truncate">{n.title}</span>
          <span className="block text-xs text-gray-400 mt-0.5 truncate">{firstLine(n.body)}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Скрыть"
        className="absolute top-1/2 -translate-y-1/2 right-1.5 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-300"
      >
        <Icon name="x" className="w-4 h-4" />
      </button>
    </div>
  );
}
