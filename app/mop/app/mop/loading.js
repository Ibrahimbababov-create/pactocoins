export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-4 w-24 bg-dark-800 rounded mb-2" />
        <div className="h-7 w-40 bg-dark-800 rounded" />
      </div>
      <div className="bg-dark-800 border border-dark-600 rounded-3xl p-6 h-48" />
      <div className="bg-dark-800 border border-dark-600 rounded-2xl h-14" />
    </div>
  );
}
