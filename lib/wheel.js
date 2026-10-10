import { formatCoins, spinsNom } from "@/lib/plural";
// Общие помощники «Колеса фортуны».

export const PRIZE_TYPES = [
  { value: "nothing", label: "Мимо (ничего)" },
  { value: "coins", label: "Коины" },
  { value: "spins", label: "Ещё крутки" },
  { value: "custom", label: "Приз вручную (только уведомление)" },
];

// Фирменные цвета: кислотный через графит, а не радуга из другого продукта.
export const WHEEL_PALETTE = [
  "#A3FF12",
  "#20242A",
  "#7FCF12",
  "#2B313A",
  "#BCFF52",
  "#171C22",
  "#5C8A0D",
  "#12161B",
];

// Цвета палитры лежат в базе как hex «кислотной» темы. На экране подменяем
// их оттенками текущей темы, чтобы колесо не светилось зелёным посреди
// латуни. Свой цвет, не из палитры, рисуем как есть.
const THEMED = {
  "#A3FF12": { fill: "rgb(var(--c-accent))", light: true },
  "#BCFF52": { fill: "rgb(var(--c-accent) / 0.85)", light: true },
  "#7FCF12": { fill: "rgb(var(--c-accent-strong))", light: true },
  "#5C8A0D": { fill: "rgb(var(--c-accent) / 0.45)", light: false },
  "#20242A": { fill: "rgb(var(--c-card))", light: false },
  "#2B313A": { fill: "rgb(var(--c-border))", light: false },
  "#171C22": { fill: "rgb(var(--c-line))", light: false },
  "#12161B": { fill: "rgb(var(--c-line))", light: false },
};

const LIGHT_FILLS = new Set(
  Object.values(THEMED)
    .filter((t) => t.light)
    .map((t) => t.fill)
);

// Текст на светлом сегменте — тёмный, на тёмном — светлый.
export function segmentTextColor(color) {
  return LIGHT_FILLS.has(color) ? "rgb(var(--c-accent-ink))" : "rgb(var(--c-text))";
}

export function segmentColor(seg, idx) {
  const raw = seg?.color || WHEEL_PALETTE[idx % WHEEL_PALETTE.length];
  return THEMED[String(raw).toUpperCase()]?.fill ?? raw;
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

// Колесо доступно сотрудникам?
export function isWheelOpen(config) {
  if (!config || config.is_open === false) return false;
  if (config.opens_at && new Date(config.opens_at) > new Date()) return false;
  return true;
}

// "7 сентября, 12:00" по Алматы из ISO-строки
export function formatOpensAt(isoStr) {
  if (!isoStr) return null;
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Asia/Almaty",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoStr));
  } catch {
    return null;
  }
}

export function prizeText(prizeType, prizeAmount) {
  if (prizeType === "coins") return `+${formatCoins(prizeAmount)}`;
  if (prizeType === "spins")
    return `+${prizeAmount} ${spinsNom(prizeAmount)}`;
  if (prizeType === "custom") return "Приз — админ свяжется";
  return "Мимо";
}
