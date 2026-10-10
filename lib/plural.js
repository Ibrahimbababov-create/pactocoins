// Русские окончания после числа: 1 коин, 2 коина, 5 коинов, 11 коинов, 21 коин.
export function plural(n, one, few, many) {
  const abs = Math.abs(Math.trunc(Number(n) || 0)) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

// «1 234 коина». Если пришло не число (например «?»), слово оставляем «коинов».
export function formatCoins(n) {
  const num = Number(n);
  if (n === null || n === undefined || n === "" || !Number.isFinite(num)) {
    return `${n ?? ""} коинов`;
  }
  return `${num.toLocaleString("ru-RU")} ${plural(num, "коин", "коина", "коинов")}`;
}

// «У тебя 3 крутки», «+5 круток».
export function spinsNom(n) {
  return plural(n, "крутка", "крутки", "круток");
}

// «Начислили 1 крутку», «Купить 2 крутки».
export function spinsAcc(n) {
  return plural(n, "крутку", "крутки", "круток");
}
