export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-48 bg-dark-800 rounded" />
      <div className="h-12 bg-dark-800 border border-dark-600 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-dark-800 border border-dark-600 rounded-2xl h-32"
          />
        ))}
      </div>
    </div>
  );
}
