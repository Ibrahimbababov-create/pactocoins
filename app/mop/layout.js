import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import SideMenu from "@/components/SideMenu";
import PageTransition from "@/components/PageTransition";
import StickyBalance from "@/components/StickyBalance";

export default async function MopLayout({ children }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, balance")
    .eq("id", user.id)
    .single();

  const { count: unreadCount } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  return (
    <div className="relative min-h-screen bg-dark-900 pb-20">
      {/* мягкое свечение сверху за шапкой */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(163,255,18,0.07),transparent_70%)]" />

      <StickyBalance balance={profile?.balance ?? 0} />

      {profile?.role === "admin" && (
        <div className="bg-acid-400 text-black text-sm font-bold px-4 py-2 flex items-center justify-between gap-2">
          <span>👁 Просмотр как МОП</span>
          <Link href="/admin" className="underline">
            Вернуться в админку
          </Link>
        </div>
      )}
      <div className="relative max-w-lg mx-auto px-4 pt-6">
        <div className="flex justify-end items-center mb-2">
          <SideMenu unreadCount={unreadCount ?? 0} />
        </div>
        <PageTransition>{children}</PageTransition>
      </div>
      <BottomNav />
    </div>
  );
}
