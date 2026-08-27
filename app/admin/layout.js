import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
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

  if (profile?.role !== "admin") redirect("/mop");

  const { count: unreadMessages } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  const { count: unreadBotMessages } = await supabase
    .from("bot_inbox_messages")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);

  return (
    <div className="relative min-h-screen bg-dark-900">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(163,255,18,0.06),transparent_70%)]" />
      <div className="relative border-b border-dark-600 bg-dark-800/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-black text-lg">
            Pacto<span className="text-acid-400">Coins</span>{" "}
            <span className="text-gray-500 font-normal text-sm">admin</span>
          </h1>
          <AdminSideMenu
            unreadMessages={unreadMessages ?? 0}
            unreadBotMessages={unreadBotMessages ?? 0}
          />
        </div>
        <AdminNav />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 py-6">
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}
