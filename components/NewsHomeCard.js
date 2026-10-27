import Link from "next/link";
import Icon from "@/components/Icon";
import { firstLine } from "@/lib/appNews";

// Карточка «Новости» на главной: последняя новость и число непрочитанных.
export default function NewsHomeCard({ latest, unread }) {
  if (!latest) return null;
  return (
    <Link
      href="/mop/news"
      className={`flex items-center gap-3.5 rounded-2xl border p-4 active:opacity-80 transition ${
        unread > 0 ? "border-acid-400/40 bg-acid-400/[0.07]" : "border-dark-700 bg-dark-800"
      }`}
    >
      <span className="relative flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-acid-400/10 text-acid-400">
        <Icon name="megaphone" className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-acid-400 text-black text-[10px] font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-gray-500">Новости</span>
        <span className="block font-semibold truncate">{latest.title}</span>
        <span className="block text-sm text-gray-400 truncate">{firstLine(latest.body)}</span>
      </span>
      <Icon name="chevronRight" className="w-4 h-4 shrink-0 text-gray-600" />
    </Link>
  );
}
