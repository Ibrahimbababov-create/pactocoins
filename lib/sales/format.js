// Форматирование сумм для аналитики. Без toLocaleString: на сервере и в
// телефоне он может дать разный результат и сломать гидратацию.

export const money = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";

export function mln(n) {
  const v = Math.abs(n || 0);
  if (v >= 1e6) return (Math.round((n / 1e6) * 10) / 10).toString().replace(".", ",") + " млн ₸";
  if (v >= 1e3) return Math.round(n / 1e3) + " тыс ₸";
  return Math.round(n || 0) + " ₸";
}

export const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

// Телефон в тексте (7+ цифр с пробелами, скобками, дефисами) → «***»
export const hidePhones = (s) => String(s ?? "").replace(/\+?\d[\d\s()\-]{5,}\d/g, "***");
// Имя клиента без телефона: если в ФИО одни цифры, показываем заглушку
export const NO_FIO = "Клиент без ФИО";
export const isPhoneLike = (s) => /^[\d+\s()\-]+$/.test(String(s ?? "").trim());
