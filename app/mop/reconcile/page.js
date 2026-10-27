import ReconcileScreen from "@/components/ReconcileScreen";

export const dynamic = "force-dynamic";

export default function MopReconcilePage({ searchParams }) {
  return (
    <ReconcileScreen
      searchParams={searchParams}
      basePath="/mop/reconcile"
      backLink={{ href: "/mop/more", label: "Ещё" }}
    />
  );
}
