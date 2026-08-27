export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-7 w-28" />
      <div className="skeleton h-10 rounded-xl" />
      <div className="skeleton h-10 rounded-xl" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
