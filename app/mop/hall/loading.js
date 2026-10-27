// Каркас Зала славы: та же шапка и вкладки, что у Рейтинга, пока считаются рекорды.
// Без этого файла показывался каркас главной (кольцо баланса и цель), и казалось,
// что открылся другой сайт.
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="skeleton h-7 w-28" />
        <div className="skeleton h-4 w-64" />
      </div>
      <div className="skeleton h-12 rounded-2xl" />
      <div className="skeleton h-44 rounded-3xl" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton h-20 rounded-2xl" />
      ))}
    </div>
  );
}
