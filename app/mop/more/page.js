import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import Icon from "@/components/Icon";
import AddToHomeScreen from "@/components/AddToHomeScreen";
import LogoutButton from "@/components/LogoutButton";

const ROLE_LABELS = {
  mop: "Менеджер отдела продаж",
  rop: "Руководитель отдела продаж",
  trainee: "Стажёр",
};

export default async function MorePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { count: unreadCount }] = await Promise.all([
    supabase
      .from("users")
      .select("name, role, rop_id, is_guest")
      .eq("id", user.id)
      .single(),
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null),
  ]);

  const role = profile?.role;

  const { data: rop } = profile?.rop_id
    ? await supabase.from("users").select("name").eq("id", profile.rop_id).single()
    : { data: null };

  // Разложено по смыслу: сначала своё, потом рабочее, потом настройки.
  // Одним списком из семи одинаковых строк это читалось как свалка.
  const groups = [
    {
      title: "Мои коины",
      items: [
        { href: "/mop/history", label: "История и покупки", icon: "history" },
        { href: "/mop/funds", label: "Копилки команды", icon: "piggy" },
        {
          href: "/mop/shop#suggest",
          label: "Предложить награду",
          icon: "sparkle",
        },
      ],
    },
    {
      title: "Работа",
      items: [
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
        {
          href: "/messages",
          label: "Сообщения",
          icon: "mail",
          badge: unreadCount ?? 0,
        },
      ].filter(Boolean),
    },
    {
      title: null,
      items: [
        { href: "/mop/settings", label: "Настройки и уведомления", icon: "settings" },
        { href: "/mop/help", label: "Как всё устроено", icon: "help" },
      ],
    },
  ];

  const initial = (profile?.name ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-display font-bold">Ещё</h1>

      <Link
        href="/mop/settings"
        className="flex items-center gap-3.5 bg-dark-800 border border-dark-700 rounded-2xl p-4 active:bg-dark-700 transition"
      >
        <span className="w-[52px] h-[52px] shrink-0 rounded-full bg-acid-400/10 border border-acid-400/40 flex items-center justify-center font-display font-bold text-lg text-acid-400">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold truncate">{profile?.name}</span>
          <span className="block text-sm text-gray-500 truncate">
            {ROLE_LABELS[role] ?? "Сотрудник"}
            {rop?.name ? ` · команда ${rop.name}` : ""}
          </span>
        </span>
        <Icon name="chevronRight" className="w-4 h-4 shrink-0 text-gray-600" />
      </Link>

      {groups.map((group, gi) => (
        <div key={gi} className="space-y-1">
          {group.title && (
            <p className="text-sm text-gray-500 px-1">{group.title}</p>
          )}
          <div className="divide-y divide-dark-700">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 py-3.5 active:opacity-60 transition"
              >
                <Icon name={item.icon} className="w-5 h-5 shrink-0 text-gray-400" />
                <span className="flex-1">{item.label}</span>
                {item.badge > 0 && (
                  <span className="bg-acid-400 text-black text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
                <Icon name="chevronRight" className="w-4 h-4 shrink-0 text-gray-600" />
              </Link>
            ))}
          </div>
        </div>
      ))}

      <AddToHomeScreen />

      <div className="flex justify-center pt-2 pb-4">
        <LogoutButton />
      </div>
    </div>
  );
}
