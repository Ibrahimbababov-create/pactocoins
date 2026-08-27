import { relativeTime } from "@/lib/relativeTime";
import Icon from "@/components/Icon";

const KIND_LABEL = {
  purchase: "покупка",
  goal_achieved: "накопил на цель",
  level_up: "новый ранг",
};

// Лёгкая лента последних событий команды. Серверный компонент — без
// интерактива, просто рендер списка.
export default function TeamFeed({ events }) {
  if (!events || events.length === 0) return null;

  const ICON_FOR = {
    purchase: "bag",
    goal_achieved: "target",
    level_up: "award",
  };

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">
        Что у команды
      </p>
      <ul className="space-y-3">
        {events.map((e, i) => (
          <li
            key={e.id}
            className="stagger-item flex items-start gap-3 text-sm"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <span className="mt-0.5 shrink-0 text-gray-500">
              <Icon name={ICON_FOR[e.kind] ?? "bag"} className="w-4 h-4" />
            </span>
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
