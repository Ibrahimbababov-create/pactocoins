// Единая точка списания коинов.
//
// Раньше каждое место делало «прочитали баланс → сравнили → записали новый».
// Между чтением и записью успевает влезть второй такой же запрос: оба видят
// 1000, оба разрешают покупку за 500, оба записывают 500. Человек получает
// две награды за одни коины. Достаточно дважды быстро нажать кнопку.
//
// spend_coins делает проверку и списание одним SQL-запросом, поэтому второй
// запрос физически не может пройти по устаревшему балансу.
// Возвращает { ok: true, balance } либо { ok: false, error }.
export async function spendCoins(admin, userId, amount, { spinsDelta = 0 } = {}) {
  const cost = Math.round(Number(amount));

  if (!Number.isFinite(cost) || cost <= 0) {
    return { ok: false, error: "Некорректная сумма" };
  }

  const { data, error } = await admin.rpc("spend_coins", {
    uid: userId,
    amount: cost,
    spins_delta: spinsDelta,
  });

  if (error) {
    console.error("[spendCoins]", error);
    return { ok: false, error: "Ошибка списания баланса" };
  }

  // null = условие balance >= amount не выполнилось, ничего не списано.
  if (data === null || data === undefined) {
    return { ok: false, error: "Недостаточно коинов" };
  }

  return { ok: true, balance: data };
}
