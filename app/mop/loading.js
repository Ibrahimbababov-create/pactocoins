export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-7 w-40" />
      </div>
      <div className="skeleton h-52 rounded-3xl" />
      <div className="skeleton h-24 rounded-2xl" />
      <div className="skeleton h-14 rounded-2xl" />
      <div className="skeleton h-14 rounded-2xl" />
    </div>
  );
}
