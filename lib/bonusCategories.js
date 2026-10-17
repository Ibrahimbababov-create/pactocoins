import { formatCoins, spinsNom } from "@/lib/plural";

export const BONUS_CATEGORIES = {
  // spins — награда не коинами, а крутками на колесе фортуны. «На линии»
  // перевели на крутки в октябре 2026 (решение Ибрагима): в среднем крутка
  // даёт около 100 коинов, так что 2 и 3 крутки стоят как прежние 200 и 260.
  attendance: { label: "Приход вовремя", amount: 0, spin: true, spins: 1 },
  online_2h: { label: "На линии 2 часа", amount: 0, spin: true, spins: 2 },
  online_3h: { label: "На линии 3 часа", amount: 0, spin: true, spins: 3 },
  // hidden — снято с формы (октябрь 2026): за объём продаж теперь платит
  // прогрессивная шкала коинов, эти бонусы платили за то же самое второй
  // раз. Записи оставлены, чтобы старые заявки показывались и одобрялись.
  overplan_120: { label: "Перевыполнение плана на 120%", amount: 2000, hidden: true },
  three_payments: {
    label: "3 оплаты за день (чек от 250 000 ₸)",
    amount: 1000,
    hidden: true,
  },
  game: { label: "Игры / розыгрыш", amount: null },
  custom: { label: "Своё (то, что не входило в обязанности)", amount: null },
};

// Название бонуса для людей: в историю и в сообщения бота. Раньше туда
// попадал служебный ключ — «Бонус: overplan_120».
export function bonusLabel(category) {
  return BONUS_CATEGORIES[category]?.label ?? (category || "Бонус");
}

// Сколько круток даёт заявка. Старые заявки, поданные ещё за коины
// (amount_coins > 0), одобряются коинами, как человек и просил.
export function bonusSpins(request) {
  const meta = BONUS_CATEGORIES[request?.category];
  if (!meta?.spins) return 0;
  if ((request?.amount_coins ?? 0) > 0) return 0;
  return meta.spins;
}

// Награда заявки для экрана: «2 крутки на колесе» или «200 коинов».
export function bonusRewardText(request) {
  const n = bonusSpins(request);
  if (n > 0) return `${n} ${spinsNom(n)} на колесе`;
  return formatCoins(request?.amount_coins ?? 0);
}
