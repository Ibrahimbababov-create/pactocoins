import Link from "next/link";
import Icon from "@/components/Icon";

// Шапка экрана игры: назад к списку игр + название.
export default function GameHeader({ title, back = "/mop/games", backLabel = "Игры" }) {
  return (
    <div>
      <Link
        href={back}
        className="inline-flex items-center gap-1 -ml-1 py-1 pr-2 text-sm text-gray-400 active:opacity-60"
      >
        <Icon name="chevronLeft" className="w-4 h-4" />
        {backLabel}
      </Link>
      <h1 className="text-2xl font-display font-bold mt-1">{title}</h1>
    </div>
  );
}
