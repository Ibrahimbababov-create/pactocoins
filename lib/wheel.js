// Общие помощники «Колеса фортуны».

export const PRIZE_TYPES = [
  { value: "nothing", label: "Мимо (ничего)" },
  { value: "coins", label: "Coins" },
  { value: "spins", label: "Ещё крутки" },
  { value: "custom", label: "Приз вручную (только уведомление)" },
];

export const WHEEL_PALETTE = [
  "#65a30d",
  "#0891b2",
  "#ca8a04",
  "#dc2626",
  "#7c3aed",
  "#db2777",
  "#0d9488",
  "#3f3f46",
];

export function segmentColor(seg, idx) {
  return seg?.color || WHEEL_PALETTE[idx % WHEEL_PALETTE.length];
}

// Взвешенный случайный выбор индекса сегмента. Сегменты с weight <= 0
// игнорируются. Возвращает -1 если выбирать не из чего.
export function pickSegmentIndex(segments, rnd = Math.random) {
  const list = segments ?? [];
  const total = list.reduce((s, x) => s + Math.max(0, x.weight || 0), 0);
  if (total <= 0) return -1;
  let r = rnd() * total;
  for (let i = 0; i < list.length; i++) {
    r -= Math.max(0, list[i].weight || 0);
    if (r < 0) return i;
  }
  return list.length - 1;
}

// Средняя выплата за одну крутку в coins (для админа).
// «Ещё крутка» считается по средней стоимости крутки в coins (грубая оценка:
// рекурсивно домножаем на шанс бесплатной крутки).
export function expectedPayoutCoins(segments) {
  const list = (segments ?? []).filter((s) => s.is_active !== false);
  const total = list.reduce((s, x) => s + Math.max(0, x.weight || 0), 0);
  if (total <= 0) return 0;

  let coinsEV = 0;
  let freeSpinProb = 0;
  for (const s of list) {
    const p = Math.max(0, s.weight || 0) / total;
    if (s.prize_type === "coins") coinsEV += p * (s.prize_amount || 0);
    if (s.prize_type === "spins") freeSpinProb += p * (s.prize_amount || 0);
  }
  // геом. ряд: каждая бесплатная крутка снова даёт coinsEV в среднем
  const multiplier = freeSpinProb < 1 ? 1 / (1 - freeSpinProb) : 3;
  return Math.round(coinsEV * multiplier);
}

export function prizeText(prizeType, prizeAmount) {
  if (prizeType === "coins") return `+${prizeAmount} coins`;
  if (prizeType === "spins")
    return `+${prizeAmount} ${prizeAmount === 1 ? "крутка" : "крутки"}`;
  if (prizeType === "custom") return "Приз — админ свяжется";
  return "Мимо";
}
