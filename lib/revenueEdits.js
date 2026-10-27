// Исправления оплат (таблица revenue_edit_requests, supabase/revenue_edit_requests.sql).
// Общие правила для сотрудника, админки и сервера.

import { PRODUCT_LABELS, PAY_LABELS } from "@/lib/revenueKinds";
import { almatyDayKey, lastMonthRangeAlmaty, formatPaymentDay } from "@/lib/timezone";

export const EDIT_FIELDS = [
  "amount_kzt",
  "earned_at",
  "client_name",
  "product_kind",
  "pay_kind",
  "is_final_part",
];

export const EDIT_FIELD_LABELS = {
  amount_kzt: "Сумма",
  earned_at: "Дата оплаты",
  client_name: "ФИО клиента",
  product_kind: "Продукт",
  pay_kind: "Вид оплаты",
  is_final_part: "Последняя часть",
};

export const EDIT_REASON_MAX = 500;

// Таблицы ещё нет (миграция не применена): Postgres 42P01 или
// «не найдена в кэше схемы» от PostgREST.
export function isMissingTable(error) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

// Дата оплаты в исправлении: не позже сегодня и не раньше первого числа
// прошлого месяца (по Алматы). Строки "YYYY-MM-DD" сравниваются как текст.
export function editDateBounds() {
  return {
    min: almatyDayKey(lastMonthRangeAlmaty().start),
    max: almatyDayKey(new Date()),
  };
}

// Дата оплаты строки как день по Алматы (у старых заявок earned_at пустой).
export function paymentDayKey(row) {
  const v = row?.earned_at || row?.created_at;
  return v ? almatyDayKey(v) : "";
}

// Снимок полей оплаты, которые можно исправить.
export function editSnapshot(row) {
  return {
    amount_kzt: row?.amount_kzt ?? null,
    earned_at: row?.earned_at || row?.created_at || null,
    client_name: row?.client_name ?? null,
    product_kind: row?.product_kind ?? null,
    pay_kind: row?.pay_kind ?? null,
    is_final_part: row?.is_final_part ?? null,
  };
}

// Одинаковы ли значения поля (дата сравнивается по дню, ФИО без регистра
// и лишних пробелов, но «Иванов» → «иванов» всё равно считается правкой).
export function sameValue(field, a, b) {
  if (field === "earned_at") {
    if (!a || !b) return !a && !b;
    return almatyDayKey(a) === almatyDayKey(b);
  }
  if (field === "client_name") {
    return String(a ?? "").replace(/\s+/g, " ").trim() === String(b ?? "").replace(/\s+/g, " ").trim();
  }
  if (field === "amount_kzt") return Number(a ?? 0) === Number(b ?? 0);
  if (field === "is_final_part") return Boolean(a) === Boolean(b);
  return (a ?? null) === (b ?? null);
}

// Поля, которые изменились между снимком на момент подачи и оплатой сейчас.
export function driftedFields(original, current, fields = EDIT_FIELDS) {
  if (!original) return [];
  return fields.filter((f) => f in original && !sameValue(f, original[f], current?.[f]));
}

function money(n) {
  return `${Number(n ?? 0).toLocaleString("ru-RU")} ₸`;
}

// Значение поля для экрана и сообщений.
export function editValueText(field, value) {
  if (value === null || value === undefined || value === "") return "не указано";
  switch (field) {
    case "amount_kzt":
      return money(value);
    case "earned_at":
      return formatPaymentDay(value);
    case "product_kind":
      return PRODUCT_LABELS[value] ?? String(value);
    case "pay_kind":
      return PAY_LABELS[value] ?? String(value);
    case "is_final_part":
      return value ? "да" : "нет";
    default:
      return String(value);
  }
}
