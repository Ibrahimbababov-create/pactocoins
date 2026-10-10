import { almatyDayKey, monthRangeAlmaty } from "@/lib/timezone";

// Сколько подтверждённой выручки у человека уже есть в месяце даты оплаты
// (по Алматы), не считая заявку excludeId. Нужна шкале коинов.
export async function monthRevenueBefore(admin, userId, earnedAtIso, excludeId) {
  const range = monthRangeAlmaty(almatyDayKey(earnedAtIso).slice(0, 7));
  const { data } = await admin
    .from("revenue_requests")
    .select("id, amount_kzt, earned_at, created_at")
    .eq("user_id", userId)
    .eq("status", "approved")
    .gte("earned_at", range.start)
    .lt("earned_at", range.end);
  return (data ?? [])
    .filter((r) => r.id !== excludeId)
    .reduce((s, r) => s + (Number(r.amount_kzt) || 0), 0);
}
