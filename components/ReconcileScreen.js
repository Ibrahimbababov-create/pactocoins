import { Suspense } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import { getReconcile } from "@/lib/reconcile";
import { currentMonthKeyAlmaty, recentMonthKeysAlmaty } from "@/lib/timezone";
import { reconcileViewer } from "@/app/admin/reconcileActions";
import ReconcileClient from "@/components/ReconcileClient";
import ReconcileSkeleton from "@/components/ReconcileSkeleton";

export default async function ReconcileScreen({ searchParams, basePath, backLink }) {
  const viewer = await reconcileViewer();
  if (!viewer) redirect("/mop");

  const months = recentMonthKeysAlmaty(2);
  const monthKey = months.some((m) => m.key === searchParams?.month)
    ? searchParams.month
    : currentMonthKeyAlmaty();

  return (
    <div className="space-y-4">
      <div>
        {backLink && (
          <Link
            href={backLink.href}
            className="inline-flex items-center gap-1 -ml-1 py-1 pr-2 text-sm text-gray-400 active:opacity-60"
          >
            <Icon name="chevronLeft" className="w-4 h-4" />
            {backLink.label}
          </Link>
        )}
        <h1 className="text-2xl font-display font-bold mt-1">Сверка с таблицами</h1>
        <p className="text-sm text-gray-500 mt-1">
          Сравниваем продажи в Google-таблице команды с тем, что записано в
          PactoCoins. Если в таблице больше, значит часть оплат осталась без коинов
          и без места в рейтинге: напомните человеку подать их.
        </p>
      </div>

      <div className="flex gap-2">
        {months.map((m) => (
          <Link
            key={m.key}
            href={`${basePath}?month=${m.key}`}
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

      <Suspense key={monthKey} fallback={<ReconcileSkeleton />}>
        <ReconcileData monthKey={monthKey} viewer={viewer} />
      </Suspense>
    </div>
  );
}

// Тяжёлая часть (чтение таблиц и пересчёт) грузится отдельно: заголовок и
// переключатель месяцев появляются сразу, пока здесь крутится заглушка.
async function ReconcileData({ monthKey, viewer }) {
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
    <>
      {error && <p className="text-sm text-red-400">Не получилось собрать сверку: {error}</p>}
      {data && (
        <ReconcileClient
          monthKey={monthKey}
          data={data}
          projects={projects ?? []}
          isAdmin={viewer.role === "admin"}
        />
      )}
    </>
  );
}
