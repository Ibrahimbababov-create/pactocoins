import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ObserverNav from "@/components/ObserverNav";
import LogoutButton from "@/components/LogoutButton";

export default async function ObserverLayout({ children }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { count: unreadCount } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  return (
    <div className="min-h-screen bg-dark-900">
      <div className="border-b border-dark-600 bg-dark-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-black text-lg">
            Pacto<span className="text-acid-400">Coins</span>{" "}
            <span className="text-gray-500 font-normal text-sm">
              наблюдатель
            </span>
          </h1>
          <div className="flex items-center gap-4">
            <Link href="/levels" className="text-gray-400 text-sm">
              🏆 Звания
            </Link>
            <Link href="/funds" className="text-gray-400 text-sm">
              🐷 Копилки
            </Link>
            <Link
              href="/messages"
              className="relative text-gray-400 text-sm"
            >
              ✉ Сообщения
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
      <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
