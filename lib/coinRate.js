// 1 coin за каждую 1000 ₸ выручки, умноженное на личный множитель
// сотрудника (coin_rate_multiplier, по умолчанию 1 — обычный МОП;
// выше 1 — например тимлид, у которого свой процент от выручки).
// Это базовая ставка — для подсказок «сколько получишь». Начисление при
// одобрении идёт по шкале ниже (tieredRevenueCoins).
export function calculateRevenueCoins(amountKzt, multiplier = 1) {
  return Math.floor((amountKzt / 1000) * (multiplier || 1));
}

// Прогрессивная шкала за месяц (по дате оплаты, по Алматы). Заменила
// месячный приз за топ-3 (решение Ибрагима, октябрь 2026): каждый, кто
// перешагнул порог, получает больше за каждую следующую тысячу — а эта
// выручка почти целиком идёт в прибыль, базовые расходы уже покрыты.
// Стоимость программы на сентябрьских цифрах ≈ как раньше (~9–10% чистой
// прибыли), просто деньги идут тем, кто тянет выручку вверх.
export const REVENUE_TIERS = [
  { from: 0, rate: 1 },
  { from: 5000000, rate: 2, label: "5 млн ₸" },
  { from: 10000000, rate: 3, label: "10 млн ₸" },
];

// Коины, накопленные выручкой monthKzt с начала месяца, дробные
// (66 500 ₸ по ставке 1 = 66,5 коина). Ставка каждого «этажа» шкалы
// действует только на свою часть суммы.
function exactTieredCoins(monthKzt, multiplier = 1) {
  const end = Math.max(0, Number(monthKzt) || 0);
  let weightedKzt = 0;
  REVENUE_TIERS.forEach((tier, i) => {
    const tierEnd = REVENUE_TIERS[i + 1]?.from ?? Infinity;
    const overlap = Math.min(end, tierEnd) - tier.from;
    if (overlap > 0) weightedKzt += overlap * tier.rate;
  });
  return (weightedKzt / 1000) * (multiplier || 1);
}

// Коины за оплату amountKzt, если до неё за этот месяц уже было
// подтверждено monthBeforeKzt. Каждая часть суммы считается по ставке
// своего «этажа»: оплата 1 млн при 4,5 млн до неё — 500 тыс по ×1 и
// 500 тыс по ×2.
// Дробная часть не теряется: считаем целые коины нарастающим итогом за
// месяц. Оплата 66 500 ₸ даёт 66 коинов, вторая такая же — уже 67 (вместе
// 133, а не 132). В базе остаются целые коины, дроби нигде не видны.
export function tieredRevenueCoins(amountKzt, multiplier = 1, monthBeforeKzt = 0) {
  const start = Math.max(0, Number(monthBeforeKzt) || 0);
  const end = start + Math.max(0, Number(amountKzt) || 0);
  // round(…, 6) гасит двоичный шум вроде 132,99999999
  const whole = (kzt) => Math.floor(Number(exactTieredCoins(kzt, multiplier).toFixed(6)));
  return whole(end) - whole(start);
}

// Текущая ставка и следующий порог для выручки за месяц.
export function tierForMonth(monthKzt) {
  const v = Math.max(0, Number(monthKzt) || 0);
  let idx = 0;
  REVENUE_TIERS.forEach((t, i) => {
    if (v >= t.from) idx = i;
  });
  const next = REVENUE_TIERS[idx + 1] ?? null;
  return {
    rate: REVENUE_TIERS[idx].rate,
    next: next ? { ...next, left: next.from - v } : null,
  };
}

// Обратная задача: сколько выручки нужно, чтобы заработать coins коинов,
// если за месяц уже есть monthKzt. Идём по этажам шкалы вверх — у того,
// кто уже за 5 и за 10 млн, каждая тысяча приносит 2 и 3 коина, и продаж нужно
// заметно меньше, чем по базовой ставке.
export function revenueForCoins(coins, multiplier = 1, monthKzt = 0) {
  let left = Math.max(0, Number(coins) || 0) / (multiplier || 1);
  let pos = Math.max(0, Number(monthKzt) || 0);
  let kzt = 0;
  for (let i = 0; i < REVENUE_TIERS.length && left > 0; i++) {
    const tier = REVENUE_TIERS[i];
    const tierEnd = REVENUE_TIERS[i + 1]?.from ?? Infinity;
    if (pos >= tierEnd) continue;
    const from = Math.max(pos, tier.from);
    const capacityCoins = ((tierEnd - from) / 1000) * tier.rate;
    if (left <= capacityCoins) {
      kzt += (left / tier.rate) * 1000;
      left = 0;
    } else {
      kzt += tierEnd - from;
      left -= capacityCoins;
      pos = tierEnd;
    }
  }
  return Math.ceil(kzt);
}
