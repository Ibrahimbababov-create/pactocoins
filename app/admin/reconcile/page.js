import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import { getReconcile } from "@/lib/reconcile";
import { currentMonthKeyAlmaty, recentMonthKeysAlmaty } from "@/lib/timezone";
import { reconcileViewer } from "@/app/admin/reconcileActions";
import ReconcileClient from "@/components/ReconcileClient";

export const dynamic = "force-dynamic";

export default async function ReconcilePage({ searchParams }) {
  const viewer = await reconcileViewer();
  if (!viewer) redirect("/mop");

  const months = recentMonthKeysAlmaty(2);
  const monthKey = months.some((m) => m.key === searchParams?.month)
    ? searchParams.month
    : currentMonthKeyAlmaty();

  const admin = createAdminClient();
  let projectsQuery = admin.from("projects").select("id, name").eq("is_active", true).order("name");
  if (viewer.projectIds) projectsQuery = projectsQuery.in("id", viewer.projectIds.length ? viewer.projectIds : ["00000000-0000-0000-0000-000000000000"]);

  let data = null;
  let error = null;
  const [{ data: projects }] = await Promise.all([
    projectsQuery,
    getReconcile(admin, monthKey, { projectIds: viewer.projectIds })
      .then((d) => (data = d))
      .catch((err) => (error = String(err?.message || err))),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold">Сверка с таблицами</h1>
        <p className="text-sm text-gray-500 mt-1">
          Сколько продаж у человека в Google-таблице команды и сколько он записал в
          PactoCoins. Разница — оплаты без коинов и без места в рейтинге.
        </p>
      </div>

      <div className="flex gap-2">
        {months.map((m) => (
          <Link
            key={m.key}
            href={`/admin/reconcile?month=${m.key}`}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              m.key === monthKey
                ? "bg-acid-400/15 border-acid-400/40 text-acid-400"
                : "border-dark-600 text-gray-400"
            }`}
          >
            {m.label}
          </Link>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">Не получилось собрать сверку: {error}</p>}
      {data && (
        <ReconcileClient
          monthKey={monthKey}
          data={data}
          projects={projects ?? []}
          isAdmin={viewer.role === "admin"}
        />
      )}
    </div>
  );
}
