import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import AdminSubNav from "@/components/AdminSubNav";
import AdminSideMenu from "@/components/AdminSideMenu";
import PageTransition from "@/components/PageTransition";

export default async function AdminLayout({ children }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const isMentor = profile?.role === "mentor";
  const isRop = profile?.role === "rop";
  if (profile?.role !== "admin" && !isMentor && !isRop) redirect("/mop");

  const { count: unreadMessages } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  const { count: unreadBotMessages } = await supabase
    .from("bot_inbox_messages")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);

  const [
    { count: pendingSuggestions },
    { count: pendingRevenue },
    { count: pendingBonus },
    { count: pendingPurchase },
    { count: pendingJoin },
  ] = await Promise.all([
    supabase
      .from("reward_suggestions")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("revenue_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("bonus_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("purchase_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("join_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const requestCounts = {
    revenue: pendingRevenue ?? 0,
    bonus: pendingBonus ?? 0,
    purchase: pendingPurchase ?? 0,
    join: pendingJoin ?? 0,
    suggestions: pendingSuggestions ?? 0,
  };
  const pendingRequests =
    requestCounts.revenue +
    requestCounts.bonus +
    requestCounts.purchase +
    requestCounts.join;

  return (
    // accentColor — чтобы галочки и переключатели были в цвет темы, а не
    // браузерно-синие. Свечение сверху тоже из темы (было кислотно-зелёным).
    <div className="relative min-h-screen bg-dark-900" style={{ accentColor: "rgb(var(--c-accent))" }}>
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgb(var(--c-accent)/0.06),transparent_70%)]" />
      <div className="relative border-b border-dark-600 bg-dark-800/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-black text-lg">
            Pacto<span className="text-acid-400">Coins</span>{" "}
            <span className="text-gray-500 font-normal text-sm">admin</span>
          </h1>
          {isRop ? (
            // РОПу админское меню ни к чему — только дорога назад в кабинет.
            <Link href="/mop" className="text-sm text-gray-400">
              В кабинет
            </Link>
          ) : (
            <AdminSideMenu
              unreadMessages={unreadMessages ?? 0}
              unreadBotMessages={unreadBotMessages ?? 0}
              pendingSuggestions={pendingSuggestions ?? 0}
            />
          )}
        </div>
        <AdminNav
          pendingRequests={isMentor ? requestCounts.join : pendingRequests}
          pendingSuggestions={requestCounts.suggestions}
          onlyOnboarding={isMentor}
          onlyReconcile={isRop}
        />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 py-6">
        {!isMentor && !isRop && <AdminSubNav counts={requestCounts} />}
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}
