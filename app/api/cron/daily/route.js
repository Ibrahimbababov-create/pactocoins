import { NextResponse } from "next/server";
import { processBirthdaysToday } from "@/lib/birthdayBonus";
import { resetGuestAccount } from "@/lib/guestAccount";
import { cleanupOldWelcomes } from "@/lib/groupWelcome";
import { syncBotCommands } from "@/lib/botCommands";
import { createAdminClient } from "@/lib/supabase-admin";
import { sweepTournaments } from "@/lib/tournament";
import { announceHallRecords } from "@/lib/hallNotify";
import { releaseMentorPiggies } from "@/lib/mentorPiggy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = {
    birthdays: [],
    guestReset: false,
  };

  try {
    summary.birthdays = await processBirthdaysToday();
  } catch (err) {
    console.error("[cron] birthday check failed:", err);
  }

  // Приветствия новичкам в группе живут около суток — крон добирает
  // те, что не убрались при следующем входе в группу.
  try {
    summary.welcomesDeleted = await cleanupOldWelcomes(20);
  } catch (err) {
    console.error("[cron] welcome cleanup failed:", err);
  }

  // Меню команд бота держим в актуальном виде (lib/botCommands.js).
  try {
    summary.botCommands = (await syncBotCommands())?.ok ?? false;
  } catch (err) {
    console.error("[cron] bot commands sync failed:", err);
  }

  // Турниры: «моя победа» без ответа соперника в срок засчитывается сама.
  // Обычно это происходит при открытии турнира; крон — страховка.
  try {
    summary.tournaments = await sweepTournaments(createAdminClient(), { limit: 100 });
  } catch (err) {
    console.error("[cron] tournaments sweep failed:", err);
  }

  // Новые рекорды Зала славы: одно сообщение в командную группу.
  try {
    summary.hall = await announceHallRecords(createAdminClient());
  } catch (err) {
    console.error("[cron] hall of fame announce failed:", err);
  }

  // 5-го числа (Алматы) копилки наставников высыпаются на баланс. В остальные
  // дни вызов ничего не делает, повторный запуск ничего не начисляет дважды.
  try {
    summary.mentorPiggy = await releaseMentorPiggies(createAdminClient());
  } catch (err) {
    console.error("[cron] mentor piggy release failed:", err);
  }

  try {
    await resetGuestAccount();
    summary.guestReset = true;
  } catch (err) {
    console.error("[cron] guest reset failed:", err);
  }

  // Личные итоги недели теперь уходят из cron отчётов в 10:00 (lib/heldReports.js).

  return NextResponse.json({ ok: true, ...summary });
}
