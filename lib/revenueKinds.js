// ФИО клиента и вид оплаты у заявки на выручку. Старые заявки без этих
// данных (null) — «неизвестно», их просто не подписываем.

export const CLIENT_NAME_MAX = 60;

export const PRODUCT_LABELS = {
  course: "Курс",
  intensive: "Интенсив / МК",
};

export const PAY_LABELS = {
  full: "Целиком",
  part: "Часть",
};

export const CLIENT_NAME_HINT = "Впиши только имя и фамилию клиента, без суммы, тарифа и контактов";
export const COMMENT_MAX = 300;

const BAD_NAME_WORDS = /(тариф|оплат|доплат|тенге|(^|\s)(моп|тг|групповой|курс)(\s|$))/i;

// Живая подсказка при вводе: true, если в строке уже есть недопустимое
// (цифры и любые символы, кроме букв, пробела, дефиса, точки и апострофа).
export function clientNameHasBadChars(raw) {
  return /[^\p{L}\s.'’\-]/u.test(String(raw ?? ""));
}

// Проверка имени клиента. Возвращает { name } или { error }.
// Только буквы, пробел, дефис, точка, апостроф; 2-60 знаков, до 5 слов.
// Телефоны, суммы и целые строки из CRM не принимаются. Проверка действует
// при создании и правке, старые записи в базе показываются как есть.
export function validateClientName(raw) {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { error: "Укажи ФИО клиента" };
  if (name.length < 2 || (name.match(/\p{L}/gu) ?? []).length < 2) {
    return { error: "ФИО клиента: хотя бы имя, минимум 2 буквы" };
  }
  if (
    name.length > CLIENT_NAME_MAX ||
    name.split(" ").length > 5 ||
    clientNameHasBadChars(name) ||
    BAD_NAME_WORDS.test(name)
  ) {
    return { error: CLIENT_NAME_HINT };
  }
  return { name };
}

// Комментарий без личных данных клиента: телефоны и почту не храним.
export function hidePhones(text) {
  return String(text ?? "").replace(/\+?\d[\d\s().\-]{5,}\d/g, (m) =>
    (m.match(/\d/g) ?? []).length >= 7 ? "***" : m
  );
}

export function hideEmails(text) {
  return String(text ?? "").replace(/[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+/g, "***@***");
}

// Чистим комментарий до записи в базу и отправки в Telegram.
export function cleanComment(raw) {
  const text = hideEmails(hidePhones(String(raw ?? ""))).trim();
  return text.slice(0, COMMENT_MAX);
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
