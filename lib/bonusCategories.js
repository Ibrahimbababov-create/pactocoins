export const BONUS_CATEGORIES = {
  // приход вовремя — не coins, а крутка на колесе фортуны (1 за заявку)
  attendance: { label: "Приход вовремя", amount: 0, spin: true },
  online_2h: { label: "На линии 2 часа", amount: 200 },
  online_3h: { label: "На линии 3 часа", amount: 260 },
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
