export const LEVELS = [
  { id: 1, name: "Новичок 1", icon: "🌱", min: 0, max: 1499, reward: null },
  { id: 2, name: "Новичок 2", icon: "🌱", min: 1500, max: 2999, reward: 50 },
  { id: 3, name: "Новичок 3", icon: "🌱", min: 3000, max: 4999, reward: 100 },
  { id: 4, name: "Стажёр 1", icon: "🥉", min: 5000, max: 9999, reward: 200 },
  { id: 5, name: "Стажёр 2", icon: "🥉", min: 10000, max: 14999, reward: 350 },
  { id: 6, name: "Стажёр 3", icon: "🥉", min: 15000, max: 19999, reward: 500 },
  { id: 7, name: "Продавец 1", icon: "🥈", min: 20000, max: 29999, reward: 800 },
  { id: 8, name: "Продавец 2", icon: "🥈", min: 30000, max: 39999, reward: 1200 },
  { id: 9, name: "Продавец 3", icon: "🥈", min: 40000, max: 49999, reward: null },
  { id: 10, name: "Профи", icon: "🥇", min: 50000, max: 99999, reward: null },
  { id: 11, name: "Мастер", icon: "💎", min: 100000, max: 149999, reward: null },
  { id: 12, name: "Легенда", icon: "👑", min: 150000, max: 249999, reward: null },
  { id: 13, name: "Чемпион", icon: "🏆", min: 250000, max: Infinity, reward: null },
];

export function getLevelForAmount(totalEarned) {
  return LEVELS.find((l) => totalEarned >= l.min && totalEarned <= l.max) ?? LEVELS[0];
}
