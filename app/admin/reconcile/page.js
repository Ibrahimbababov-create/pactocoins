import ReconcileScreen from "@/components/ReconcileScreen";

export const dynamic = "force-dynamic";

export default function ReconcilePage({ searchParams }) {
  return <ReconcileScreen searchParams={searchParams} basePath="/admin/reconcile" />;
}
