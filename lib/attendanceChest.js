import { almatyDayKey } from "@/lib/timezone";
import { chipsNom } from "@/lib/plural";

// Сундук за «Приход вовремя». Живёт в той же системе, что и подарочные
// сундуки (lib/chest.js, supabase/chest.sql): личный подарок chest_gifts.
// Открывается кнопкой в «Играх» и на главной, содержимое выдаёт SQL
// claim_chest одним запросом.
export const ATTENDANCE_CHEST_TITLE = "Сундук за приход вовремя";
export const ATTENDANCE_CHEST_CHIPS = 30;

// Ключ «один сундук на человека в день по Алматы». Уникален в базе
// (supabase/attendance_chest.sql), поэтому повторный кружок, ручное
// одобрение админом и повторный вызов дают тот же ключ и второго сундука не будет.
export const attendanceChestKey = (userId, date) => `attendance:${userId}:${almatyDayKey(date)}`;

// Положить сундук за приход. Возвращает строку для дописывания к сообщению
// человеку, если сундук выдан именно сейчас, иначе пустую строку. Любой сбой
// (в том числе нет колонки в базе до применения SQL) только пишется в лог:
// приход и крутка от этого не страдают.
export async function grantAttendanceChest(admin, request) {
  try {
    if (!request?.user_id || request.category !== "attendance") return "";
    const { error } = await admin.from("chest_gifts").insert({
      title: ATTENDANCE_CHEST_TITLE,
      chips: ATTENDANCE_CHEST_CHIPS,
      user_id: request.user_id,
      dedupe_key: attendanceChestKey(request.user_id, request.created_at ?? new Date()),
    });
    if (error) {
      if (error.code !== "23505") console.error("[attendanceChest]", error);
      return "";
    }
    return `\n\n🎁 + сундук с ${ATTENDANCE_CHEST_CHIPS} ${chipsNom(ATTENDANCE_CHEST_CHIPS)}: открой его в «Играх»`;
  } catch (err) {
    console.error("[attendanceChest]", err);
    return "";
  }
}

// Приход отменили (одобрили по ошибке): неоткрытый сундук убираем.
export async function revokeAttendanceChest(admin, request) {
  try {
    if (!request?.user_id || request.category !== "attendance") return;
    await admin
      .from("chest_gifts")
      .update({ is_active: false })
      .eq("dedupe_key", attendanceChestKey(request.user_id, request.created_at ?? new Date()));
  } catch (err) {
    console.error("[attendanceChest]", err);
  }
}
