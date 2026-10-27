import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { effectiveRole, resolveViewer } from "@/lib/viewAs";
import { loadNewsFor, NEWS_ROLES } from "@/lib/appNews";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import NewsList from "@/components/NewsList";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { viewId, watching } = await resolveViewer(supabase, user.id);
  const { data: profile } = await supabase
    .from("users")
    .select("role, is_guest")
    .eq("id", viewId)
    .single();
  const role = watching ? profile?.role : effectiveRole(profile?.role);
  if (profile?.is_guest || !NEWS_ROLES.includes(role)) redirect("/mop");

  const news = await loadNewsFor(createAdminClient(), viewId, 50);
  const items = news.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    important: n.important,
    unread: n.unread,
    when: formatDateTimeAlmaty(n.published_at),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/mop/more"
          aria-label="Назад"
          className="-ml-2 w-9 h-9 flex items-center justify-center text-gray-400"
        >
          <Icon name="chevronLeft" className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-display font-bold">Новости</h1>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Пока новостей нет.</p>
      ) : (
        <NewsList items={items} readOnly={watching} />
      )}
    </div>
  );
}
