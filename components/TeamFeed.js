import { relativeTime } from "@/lib/relativeTime";

const KIND_LABEL = {
  purchase: "покупка",
  goal_achieved: "накопил на цель",
  level_up: "новый ранг",
};

// Лёгкая лента последних событий команды. Серверный компонент — без
// интерактива, просто рендер списка.
export default function TeamFeed({ events }) {
  if (!events || events.length === 0) return null;

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
      <p className="text-sm text-gray-500 mb-3">Что у команды</p>
      <ul className="space-y-3">
        {events.map((e, i) => (
          <li
            key={e.id}
            className="stagger-item flex items-start gap-3 text-sm"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <span className="text-lg leading-none shrink-0">{e.icon || "•"}</span>
            <div className="min-w-0 flex-1">
              <p className="leading-snug">
                <span className="font-semibold">{e.user_name}</span>
                <span className="text-gray-500">
                  {" · "}
                  {KIND_LABEL[e.kind] ?? e.kind}{" "}
                </span>
                <span className="text-gray-300">«{e.title}»</span>
              </p>
              <p className="text-xs text-gray-600">{relativeTime(e.created_at)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
