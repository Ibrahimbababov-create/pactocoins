export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-32 bg-dark-800 rounded" />
      <div className="h-4 w-56 bg-dark-800 rounded" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-dark-800 border border-dark-600 rounded-xl h-16"
          />
        ))}
      </div>
    </div>
  );
}
