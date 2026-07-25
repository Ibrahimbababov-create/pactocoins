export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-48 bg-dark-800 rounded" />

      {Array.from({ length: 3 }).map((_, section) => (
        <div key={section} className="space-y-3">
          <div className="h-4 w-32 bg-dark-800 rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-dark-800 border border-dark-600 rounded-2xl h-28"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
