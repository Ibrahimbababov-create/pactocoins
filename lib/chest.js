// Сундук: подарок от Pacto, который админ иногда кладёт всем или одному
// человеку (фишки, крутки, коины). В приложении появляется сундук, открыть
// его можно один раз. Сам приз выдаёт SQL claim_chest: забирает все неоткрытые
// подарки одним запросом, двойной тап второй раз ничего не даст.

import { ATTENDANCE_CHEST_TITLE } from "@/lib/attendanceChest";

// Кому сундук: живые сотрудники в кабинете /mop. Гостю (общий
// демо-аккаунт), тестовым и уволенным не показываем.
export function chestEligible(profile) {
  if (!profile) return false;
  if (profile.is_active === false || profile.is_guest) return false;
  if ((profile.email || "").endsWith(".test@pactocoins.local")) return false;
  return profile.role !== "observer";
}

// Что лежит в сундуке для человека: сумма всех подарков, которые он ещё
// не открыл. null — сундука нет.
export async function getPendingChest(admin, userId) {
  const [{ data: gifts }, { data: claims }] = await Promise.all([
    admin
      .from("chest_gifts")
      .select("id, title, chips, spins, coins, user_id")
      .eq("is_active", true)
      .or(`user_id.is.null,user_id.eq.${userId}`),
    admin.from("chest_claims").select("gift_id").eq("user_id", userId),
  ]);
  const opened = new Set((claims ?? []).map((c) => c.gift_id));
  const fresh = (gifts ?? []).filter((g) => !opened.has(g.id));
  if (fresh.length === 0) return null;
  // Личный сундук («Сундук для Еры») называем по нему, даже если вместе с
  // ним открываются и общие подарки.
  const personal = fresh.find((g) => g.user_id);
  // Несколько сундуков за приход (не открывал несколько дней) — один заход,
  // открываются разом, а счётчик показывает, сколько их.
  const allAttendance = fresh.every((g) => g.title === ATTENDANCE_CHEST_TITLE);
  return {
    count: fresh.length,
    title:
      fresh.length > 1 && allAttendance
        ? "Сундуки за приход вовремя"
        : personal?.title ?? (fresh.length === 1 ? fresh[0].title : "Подарки от Pacto"),
    chips: fresh.reduce((s, g) => s + (g.chips || 0), 0),
    spins: fresh.reduce((s, g) => s + (g.spins || 0), 0),
    coins: fresh.reduce((s, g) => s + (g.coins || 0), 0),
  };
}
