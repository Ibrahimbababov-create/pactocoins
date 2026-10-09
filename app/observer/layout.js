import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ObserverNav from "@/components/ObserverNav";
import LogoutButton from "@/components/LogoutButton";
import PageTransition from "@/components/PageTransition";
import Icon from "@/components/Icon";
import { clearViewAs } from "@/app/admin/viewAsActions";

export default async function ObserverLayout({ children }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ count: unreadCount }, { data: profile }] = await Promise.all([
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null),
    supabase.from("users").select("role").eq("id", user.id).single(),
  ]);

  return (
    <div className="relative min-h-screen bg-dark-900">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(163,255,18,0.06),transparent_70%)]" />
      {profile?.role === "admin" && (
        <div className="relative bg-acid-400/[0.08] border-b border-acid-400/20 text-acid-400 text-sm px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
          <span className="font-semibold">Просмотр как Наблюдатель</span>
          <div className="flex items-center gap-3">
            <form action={clearViewAs}>
              <button type="submit" className="underline underline-offset-2">
                Выйти из просмотра
              </button>
            </form>
            <Link href="/admin" className="underline underline-offset-2">
              В админку
            </Link>
          </div>
        </div>
      )}
      <div className="relative border-b border-dark-600 bg-dark-800/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-black text-lg">
            Pacto<span className="text-acid-400">Coins</span>{" "}
            <span className="text-gray-500 font-normal text-sm">
              наблюдатель
            </span>
          </h1>
          <div className="flex items-center gap-4 text-gray-400 text-sm">
            <Link href="/observer/funds" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Icon name="piggy" className="w-4 h-4" /> Копилки
            </Link>
            <Link
              href="/messages"
              className="relative flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Icon name="mail" className="w-4 h-4" /> Сообщения
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-3 bg-acid-400 text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Link>
            <LogoutButton />
          </div>
        </div>
        <ObserverNav />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 py-6">
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}
