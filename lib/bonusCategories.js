export const BONUS_CATEGORIES = {
  attendance: { label: "Приход вовремя", amount: 100 },
  online_2h: { label: "На линии 2 часа", amount: 200 },
  first_plan: { label: "Первый выполнил план", amount: 1000 },
  overplan_120: { label: "Перевыполнение плана на 120%", amount: 2000 },
  three_payments: {
    label: "3 оплаты за день (чек от 250 000 ₸)",
    amount: 1000,
  },
  game: { label: "Игры / розыгрыш", amount: null },
  custom: { label: "Своё (то, что не входило в обязанности)", amount: null },
};
