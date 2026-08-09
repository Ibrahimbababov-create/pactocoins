export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-32 bg-dark-800 rounded" />
      <div className="h-40 bg-dark-800 border border-dark-600 rounded-2xl" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-dark-800 border border-dark-600 rounded-xl h-16"
          />
        ))}
      </div>
    </div>
  );
}
