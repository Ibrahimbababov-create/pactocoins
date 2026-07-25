import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";

export default async function MopLayout({ children }) {
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
    <div className="min-h-screen bg-dark-900 pb-20">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex justify-end items-center gap-4 mb-2">
          <Link href="/messages" className="relative text-gray-400 text-sm">
            ✉ Сообщения
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-acid-400 text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </Link>
          <LogoutButton />
        </div>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
