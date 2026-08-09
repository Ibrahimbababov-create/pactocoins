export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-24 bg-dark-800 rounded" />
      <div className="h-7 w-32 bg-dark-800 rounded" />
      <div className="h-5 w-24 bg-dark-800 rounded ml-auto" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-dark-800 border border-dark-600 rounded-2xl h-48"
        />
      ))}
    </div>
  );
}
