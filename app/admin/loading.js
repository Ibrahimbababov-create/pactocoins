export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 bg-dark-800 rounded" />
        <div className="h-9 w-40 bg-dark-800 rounded-lg" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-dark-800 border border-dark-600 rounded-2xl h-20"
          />
        ))}
      </div>

      <div className="space-y-2">
        <div className="h-4 w-32 bg-dark-800 rounded" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-dark-800 border border-dark-600 rounded-xl h-16"
          />
        ))}
      </div>
    </div>
  );
}
