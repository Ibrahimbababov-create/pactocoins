export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-7 w-44" />
        <div className="skeleton h-4 w-56" />
      </div>

      <div className="skeleton h-44 rounded-2xl" />

      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>

      <div className="skeleton h-16 rounded-2xl" />
    </div>
  );
}
