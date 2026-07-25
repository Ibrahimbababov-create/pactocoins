export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-56 bg-dark-800 rounded" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-dark-800 border border-dark-600 rounded-xl h-20"
          />
        ))}
      </div>
    </div>
  );
}
