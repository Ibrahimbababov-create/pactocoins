import Link from "next/link";

// Переключатель «Рейтинг | Зал славы» наверху двух экранов сотрудника.
export default function RatingHallTabs({ active }) {
  const items = [
    { key: "rating", href: "/mop/rating", label: "Рейтинг" },
    { key: "hall", href: "/mop/hall", label: "Зал славы" },
  ];
  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl bg-dark-800 border border-dark-700 p-1">
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          replace
          aria-current={active === it.key ? "page" : undefined}
          className={`text-center rounded-xl py-2 text-sm font-semibold transition-colors ${
            active === it.key ? "bg-acid-400 text-black" : "text-gray-400 active:bg-dark-700"
          }`}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}
