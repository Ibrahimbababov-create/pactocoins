export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-40 bg-dark-800 rounded" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-dark-800 border border-dark-600 rounded-2xl h-32"
          />
        ))}
      </div>
    </div>
  );
}
