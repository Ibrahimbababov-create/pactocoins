// Сундук: подарок от Pacto, который админ иногда кладёт всем (фишки,
// крутки). У каждого в приложении появляется сундук, открыть его можно
// один раз. Сам приз выдаёт SQL claim_chest: забирает все неоткрытые
// подарки одним запросом, двойной тап второй раз ничего не даст.

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
    admin.from("chest_gifts").select("id, title, chips, spins").eq("is_active", true),
    admin.from("chest_claims").select("gift_id").eq("user_id", userId),
  ]);
  const opened = new Set((claims ?? []).map((c) => c.gift_id));
  const fresh = (gifts ?? []).filter((g) => !opened.has(g.id));
  if (fresh.length === 0) return null;
  return {
    title: fresh.length === 1 ? fresh[0].title : "Подарки от Pacto",
    chips: fresh.reduce((s, g) => s + (g.chips || 0), 0),
    spins: fresh.reduce((s, g) => s + (g.spins || 0), 0),
  };
}
