export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-16 rounded-2xl" />
      <div className="skeleton h-10 rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
