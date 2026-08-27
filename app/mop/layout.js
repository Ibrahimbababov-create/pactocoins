import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import PageTransition from "@/components/PageTransition";
import MopTopBar from "@/components/MopTopBar";

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

      <MopTopBar
        balance={profile?.balance ?? 0}
        unreadCount={unreadCount ?? 0}
      />

      {profile?.role === "admin" && (
        <div className="relative bg-acid-400/[0.08] border-b border-acid-400/20 text-acid-400 text-sm px-4 py-2 flex items-center justify-between gap-2">
          <span className="font-semibold">👁 Просмотр как МОП</span>
          <Link href="/admin" className="underline underline-offset-2">
            Вернуться в админку
          </Link>
        </div>
      )}
      <div className="relative max-w-lg mx-auto px-4 pt-4">
        <PageTransition>{children}</PageTransition>
      </div>
      <BottomNav />
    </div>
  );
}
