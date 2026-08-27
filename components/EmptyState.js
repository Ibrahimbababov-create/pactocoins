import Icon from "@/components/Icon";

// Единый вид для пустых состояний: иконка в мягком круге, заголовок,
// подсказка и опциональное действие.
export default function EmptyState({ icon = "sparkle", title, hint, action }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-dark-700 text-gray-500">
        <Icon name={icon} className="w-6 h-6" />
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-gray-500 max-w-xs">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
