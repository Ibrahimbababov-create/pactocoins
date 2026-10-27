import { almatyDayKey } from "@/lib/timezone";
import { addChips } from "@/lib/addChips";

// Сундук за «Приход вовремя». Живёт в той же системе, что и подарочные
// сундуки (lib/chest.js, supabase/chest.sql): личный подарок chest_gifts.
// Открывается кнопкой в «Играх» и на главной, содержимое выдаёт SQL
// claim_chest одним запросом.
export const ATTENDANCE_CHEST_TITLE = "Сундук за приход вовремя";
// Внутри 20 фишек: ровно цена одной крутки (chipPrice = 20), то есть стоимость
// для компании как у прежней прямой крутки. Решение владельца 28.10.2026.
export const ATTENDANCE_CHEST_CHIPS = 20;
export const ATTENDANCE_CHEST_SPINS = 0;

// Ключ «один сундук на человека в день по Алматы». Уникален в базе
// (supabase/attendance_chest.sql), поэтому повторный кружок, ручное
// одобрение админом и повторный вызов дают тот же ключ и второго сундука не будет.
export const attendanceChestKey = (userId, date) => `attendance:${userId}:${almatyDayKey(date)}`;

// Положить сундук за приход, который засчитал бот. Возвращает "granted"
// (положили), "duplicate" (за этот день уже есть) или "error" (не вышло, в том
// числе пока в базе нет колонки: тогда вызывающий выдаёт крутку напрямую).
export async function grantAttendanceChest(admin, request) {
  try {
    if (!request?.user_id || request.category !== "attendance") return "error";
    const { error } = await admin.from("chest_gifts").insert({
      title: ATTENDANCE_CHEST_TITLE,
      chips: ATTENDANCE_CHEST_CHIPS,
      spins: ATTENDANCE_CHEST_SPINS,
      user_id: request.user_id,
      dedupe_key: attendanceChestKey(request.user_id, request.created_at ?? new Date()),
    });
    if (error) {
      if (error.code === "23505") return "duplicate";
      console.error("[attendanceChest]", error);
      return "error";
    }
    return "granted";
  } catch (err) {
    console.error("[attendanceChest]", err);
    return "error";
  }
}

// Отмена прихода, за который бот положил сундук. Возвращает:
//  { kind: "none" }              сундука по ключу нет (старая или ручная заявка)
//  { kind: "removed" }           сундук не открыли, убрали его
//  { kind: "refunded", chips }   сундук открыли, фишки сняли (не глубже нуля)
//  { kind: "error" }             не вышло, вызывающий ничего не снимает
export async function revokeAttendanceChest(admin, request) {
  try {
    if (!request?.user_id || request.category !== "attendance") return { kind: "none" };
    const key = attendanceChestKey(request.user_id, request.created_at ?? new Date());
    const { data: gift, error } = await admin
      .from("chest_gifts")
      .select("id, chips")
      .eq("dedupe_key", key)
      .maybeSingle();
    if (error) {
      console.error("[attendanceChest revoke]", error);
      return { kind: "error" };
    }
    if (!gift) return { kind: "none" };
    const { data: claim } = await admin
      .from("chest_claims")
      .select("gift_id")
      .eq("gift_id", gift.id)
      .eq("user_id", request.user_id)
      .maybeSingle();
    if (!claim) {
      // Не открыт: удаляем. Если за это время его открыли, claims каскадно
      // уйдут вместе с подарком, поэтому проверяем результат ниже.
      const { error: delError } = await admin.from("chest_gifts").delete().eq("id", gift.id);
      if (delError) {
        console.error("[attendanceChest revoke]", delError);
        return { kind: "error" };
      }
      return { kind: "removed" };
    }
    const chips = gift.chips ?? 0;
    if (chips > 0) await addChips(admin, request.user_id, -chips, "Отмена прихода");
    return { kind: "refunded", chips };
  } catch (err) {
    console.error("[attendanceChest revoke]", err);
    return { kind: "error" };
  }
}
