// ФИО клиента и вид оплаты у заявки на выручку. Старые заявки без этих
// данных (null) — «неизвестно», их просто не подписываем.

export const CLIENT_NAME_MAX = 80;

export const PRODUCT_LABELS = {
  course: "Курс",
  intensive: "Интенсив / МК",
};

export const PAY_LABELS = {
  full: "Целиком",
  part: "Часть",
};

// Проверка имени клиента. Возвращает { name } или { error }.
// Телефоны и номера не храним (приватность): любая строка, где цифр
// больше, чем букв, или есть длинный ряд цифр, не принимается.
export function validateClientName(raw) {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, CLIENT_NAME_MAX);
  if (!name) return { error: "Укажи ФИО клиента" };
  const letters = (name.match(/\p{L}/gu) ?? []).length;
  const digits = (name.match(/\d/g) ?? []).length;
  if (name.length < 2 || letters < 2) return { error: "ФИО клиента: хотя бы имя, минимум 2 буквы" };
  if (digits > 0 && (digits >= letters || /\d{4,}/.test(name.replace(/[\s\-()+]/g, "")))) {
    return { error: "В ФИО клиента не нужны цифры и телефоны, только имя" };
  }
  return { name };
}

// Ключ для сравнения имён: без регистра, без «ё», без лишних пробелов.
export function clientKey(name) {
  return String(name ?? "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

// «Курс · Часть» / «Интенсив / МК · Целиком» / «Курс · Часть, последняя».
export function revenueKindText(r) {
  const product = PRODUCT_LABELS[r?.product_kind];
  const pay = PAY_LABELS[r?.pay_kind];
  const parts = [];
  if (product) parts.push(product);
  if (pay) parts.push(r.pay_kind === "part" && r.is_final_part ? "Часть, последняя" : pay);
  return parts.join(" · ");
}
