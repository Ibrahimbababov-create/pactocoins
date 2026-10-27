import ReconcileSkeleton from "@/components/ReconcileSkeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="skeleton h-7 w-56" />
        <div className="skeleton h-10 w-full rounded-lg" />
      </div>
      <div className="skeleton h-8 w-40 rounded-lg" />
      <ReconcileSkeleton />
    </div>
  );
}
