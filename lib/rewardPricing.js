// Действующая цена награды с учётом временной скидки.
// После sale_ends_at скидка сама перестаёт действовать — ничего
// в БД откатывать не нужно, price_coins всегда остаётся базовой ценой.
export function getEffectivePrice(reward) {
  const saleActive =
    reward.sale_price_coins != null &&
    reward.sale_ends_at != null &&
    new Date(reward.sale_ends_at).getTime() > Date.now();

  return {
    effectivePrice: saleActive ? reward.sale_price_coins : reward.price_coins,
    saleActive,
  };
}
