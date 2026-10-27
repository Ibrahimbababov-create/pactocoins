import { createClient } from "@/lib/supabase-server";
import Link from "next/link";
import Icon from "@/components/Icon";
import AddToHomeScreen from "@/components/AddToHomeScreen";
import LogoutButton from "@/components/LogoutButton";
import { effectiveRole, resolveViewer } from "@/lib/viewAs";
import { WhatsNewButton } from "@/components/WhatsNew";
import { createAdminClient } from "@/lib/supabase-admin";
import { showSurveyCard } from "@/lib/survey";
import SurveyPromoCard from "@/components/SurveyPromoCard";
import { loadNewsFor, NEWS_ROLES } from "@/lib/appNews";

// Длинные подписи — только для этого экрана, короткие живут в lib/roles.js
const ROLE_LABELS = {
  mop: "Менеджер отдела продаж",
  rop: "Руководитель отдела продаж",
  mentor: "Наставник",
  trainee: "Стажёр",
  observer: "Наблюдатель",
  admin: "Админ",
};

export default async function MorePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // В режиме просмотра показываем карточку того, чьими глазами смотрим.
  const { viewId, watching } = await resolveViewer(supabase, user.id);

  const [{ data: profile }, { count: unreadCount }] = await Promise.all([
    supabase
      .from("users")
      .select("name, role, rop_id, is_guest, is_active, email")
      .eq("id", viewId)
      .single(),
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null),
  ]);

  const role = effectiveRole(watching ? "admin" : profile?.role);

  // Опрос команды: карточка наверху, пока он открыт, а человек его не прошёл.
  const showSurvey = !watching && (await showSurveyCard(createAdminClient(), user.id));

  const { data: rop } = profile?.rop_id
    ? await supabase.from("users").select("name").eq("id", profile.rop_id).single()
    : { data: null };

  // Разложено по смыслу: сначала своё, потом рабочее, потом настройки.
  // Одним списком из семи одинаковых строк это читалось как свалка.
  const showNews =
    !profile?.is_guest && NEWS_ROLES.includes(watching ? profile?.role : role);
  const newsAll = showNews ? await loadNewsFor(createAdminClient(), viewId, 20) : [];
  const newsUnread = newsAll.filter((n) => n.unread).length;

  const groups = [
    {
      title: "Мои коины",
      items: [
        { href: "/mop/history", label: "История и покупки", icon: "history" },
        role !== "observer" &&
          role !== "trainee" &&
          !profile?.is_guest && {
            href: "/mop/payments",
            label: "Мои оплаты",
            icon: "receipt",
          },
        role !== "observer" &&
          role !== "trainee" &&
          !profile?.is_guest && {
            href: "/mop/recap",
            label: "Итог месяца",
            icon: "award",
          },
        role !== "observer" &&
          !profile?.is_guest && {
            href: "/mop/hall",
            label: "Зал славы",
            icon: "trophy",
          },
        { href: "/mop/funds", label: "Копилки команды", icon: "piggy" },
        {
          href: "/mop/shop?suggest=1",
          label: "Предложить награду",
          icon: "sparkle",
        },
        // У РОПа и наставника нет вкладки «Игры» внизу — вход в игры и турниры здесь.
        (role === "rop" || role === "mentor") && {
          href: "/mop/games",
          label: "Игры и турниры",
          icon: "trophy",
        },
      ].filter(Boolean),
    },
    {
      title: "Работа",
      items: [
        newsAll.length > 0 && {
          href: "/mop/news",
          label: "Новости",
          icon: "megaphone",
          badge: newsUnread,
        },
        role !== "trainee" && {
          href: "/mop/materials",
          label: "Регламенты и обучение",
          icon: "book",
        },
        (role === "rop" || role === "mentor") && {
          href: "/mop/onboarding-materials",
          label: "Материалы стажёрам",
          icon: "sparkle",
        },
        // РОП сверяет таблицы своей команды с PactoCoins
        role === "rop" && {
          href: "/mop/reconcile",
          label: "Сверка с таблицами",
          icon: "check",
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

      {showSurvey && <SurveyPromoCard />}

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

      <WhatsNewButton className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-60 transition border-t border-dark-700">
        <Icon name="sparkle" className="w-5 h-5 shrink-0 text-acid-400" />
        <span className="flex-1">Что нового в PactoCoins</span>
        <Icon name="chevronRight" className="w-4 h-4 shrink-0 text-gray-600" />
      </WhatsNewButton>

      <AddToHomeScreen />

      <div className="flex justify-center pt-2 pb-4">
        <LogoutButton />
      </div>
    </div>
  );
}
