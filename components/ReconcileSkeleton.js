export default function ReconcileSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="skeleton h-14 rounded-2xl" />
      <div className="skeleton h-28 rounded-2xl" />
      <div className="skeleton h-12 rounded-2xl" />
    </div>
  );
}
