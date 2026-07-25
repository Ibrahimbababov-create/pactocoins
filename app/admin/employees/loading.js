export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-40 bg-dark-800 rounded" />
      <div className="h-9 w-48 bg-dark-800 rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-dark-800 border border-dark-600 rounded-xl h-20"
          />
        ))}
      </div>
    </div>
  );
}
