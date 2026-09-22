import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import Icon from "@/components/Icon";
import AddToHomeScreen from "@/components/AddToHomeScreen";
import LogoutButton from "@/components/LogoutButton";

export default async function MorePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { count: unreadCount }] = await Promise.all([
    supabase.from("users").select("role").eq("id", user.id).single(),
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null),
  ]);

  const role = profile?.role;

  const items = [
    role !== "trainee" && {
      href: "/mop/materials",
      label: "Регламенты и обучение",
      icon: "sparkle",
    },
    role === "rop" && {
      href: "/mop/onboarding-materials",
      label: "Материалы стажёрам",
      icon: "sparkle",
    },
    { href: "/funds", label: "Копилки", icon: "piggy" },
    {
      href: "/messages",
      label: "Сообщения",
      icon: "mail",
      badge: unreadCount ?? 0,
    },
    { href: "/mop/settings", label: "Настройки", icon: "settings" },
    { href: "/mop/help", label: "Инструкция", icon: "help" },
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ещё</h1>

      <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden divide-y divide-dark-600">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between px-4 py-3.5 text-sm active:bg-dark-700 transition"
          >
            <span className="flex items-center gap-3">
              <Icon name={item.icon} className="w-5 h-5 shrink-0 text-gray-400" />
              {item.label}
            </span>
            <span className="flex items-center gap-2">
              {item.badge > 0 && (
                <span className="bg-acid-400 text-black text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
              <Icon name="chevronRight" className="w-4 h-4 text-gray-600" />
            </span>
          </Link>
        ))}
      </div>

      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
        <AddToHomeScreen />
      </div>

      <div className="flex justify-center pt-2 pb-4">
        <LogoutButton />
      </div>
    </div>
  );
}
