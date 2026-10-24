// Единая точка начисления (и ручного списания) коинов.
//
// Раньше начисления делали «прочитали баланс → прибавили → записали». Если
// в ту же секунду проходила покупка (spend_coins), одно из изменений
// затиралось. add_coins прибавляет одним SQL-запросом прямо в базе.
// amount может быть отрицательным — для отмены ошибочного начисления.
// Возвращает { balance, error } — error в форме ошибки Supabase (.message).
export async function addCoins(admin, userId, amount) {
  const delta = Math.round(Number(amount));
  if (!Number.isFinite(delta)) {
    return { balance: null, error: { message: "Некорректная сумма" } };
  }

  const { data, error } = await admin.rpc("add_coins", { uid: userId, amount: delta });
  if (error) {
    console.error("[addCoins]", error);
    return { balance: null, error };
  }
  if (data === null || data === undefined) {
    return { balance: null, error: { message: "Пользователь не найден" } };
  }
  return { balance: data, error: null };
}
