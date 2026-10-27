import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { isMissingNewsTable, NEWS_ROLES } from "@/lib/appNews";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import AdminNewsClient from "@/components/AdminNewsClient";

export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/admin");

  const admin = createAdminClient();
  const { data: news, error } = await admin
    .from("app_news")
    .select("id, title, body, important, is_published, published_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const header = (
    <div>
      <h1 className="text-2xl font-display font-bold">Что важно (новости)</h1>
      <p className="text-sm text-gray-400 mt-1">
        Сотрудники видят новости в приложении на главном экране и в разделе «Ещё». Важные
        показываются плашкой наверху главной, её можно закрыть.
      </p>
    </div>
  );

  if (error) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-2xl border border-dark-600 bg-dark-800 p-4 text-sm text-gray-400">
          {isMissingNewsTable(error)
            ? "Новости ещё не включены: в базе нет таблиц. Нужно применить supabase/app_news.sql."
            : `Не удалось загрузить новости: ${error.message}`}
        </div>
      </div>
    );
  }

  const ids = (news ?? []).map((n) => n.id);
  const [{ data: staff }, { data: reads }] = await Promise.all([
    admin
      .from("users")
      .select("id")
      .eq("is_active", true)
      .eq("is_guest", false)
      .in("role", NEWS_ROLES)
      .not("email", "like", "%.test@pactocoins.local"),
    ids.length
      ? admin.from("app_news_reads").select("news_id, user_id").in("news_id", ids).limit(20000)
      : Promise.resolve({ data: [] }),
  ]);
  const staffIds = new Set((staff ?? []).map((u) => u.id));
  const readCount = {};
  for (const r of reads ?? []) {
    if (staffIds.has(r.user_id)) readCount[r.news_id] = (readCount[r.news_id] ?? 0) + 1;
  }

  const items = (news ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    important: n.important,
    published: n.is_published,
    when: formatDateTimeAlmaty(n.is_published ? n.published_at : n.created_at),
    reads: readCount[n.id] ?? 0,
  }));

  return (
    <div className="space-y-4">
      {header}
      <AdminNewsClient items={items} staffTotal={staffIds.size} />
    </div>
  );
}
