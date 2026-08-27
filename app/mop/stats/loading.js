export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-44 bg-dark-800 rounded mb-2" />
        <div className="h-4 w-56 bg-dark-800 rounded" />
      </div>

      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
        <div className="flex items-end justify-between gap-1.5 h-28">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-dark-700 rounded-t"
              style={{ height: `${30 + ((i * 37) % 60)}%` }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-dark-800 border border-dark-600 rounded-xl h-16"
          />
        ))}
      </div>

      <div className="bg-dark-800 border border-dark-600 rounded-2xl h-16" />
    </div>
  );
}
