// 1 coin за каждую 1000 ₸ выручки, умноженное на личный множитель
// сотрудника (coin_rate_multiplier, по умолчанию 1 — обычный МОП;
// выше 1 — например тимлид, у которого свой процент от выручки).
export function calculateRevenueCoins(amountKzt, multiplier = 1) {
  return Math.floor((amountKzt / 1000) * (multiplier || 1));
}
