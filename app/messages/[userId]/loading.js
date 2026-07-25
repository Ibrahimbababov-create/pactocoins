export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 bg-dark-800 rounded" />
        <div className="h-6 w-32 bg-dark-800 rounded" />
      </div>

      <div className="space-y-2">
        <div className="h-10 w-2/3 bg-dark-800 border border-dark-600 rounded-2xl" />
        <div className="h-10 w-1/2 bg-acid-400/20 rounded-2xl ml-auto" />
        <div className="h-10 w-3/5 bg-dark-800 border border-dark-600 rounded-2xl" />
        <div className="h-10 w-1/3 bg-acid-400/20 rounded-2xl ml-auto" />
      </div>

      <div className="h-16 bg-dark-800 border border-dark-600 rounded-xl" />
      <div className="h-11 bg-dark-800 rounded-lg" />
    </div>
  );
}
