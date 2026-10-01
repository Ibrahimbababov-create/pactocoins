import { NextResponse } from "next/server";
import { processBirthdaysToday } from "@/lib/birthdayBonus";
import { resetGuestAccount } from "@/lib/guestAccount";
import { getEarningsForRange } from "@/lib/weeklyMonthlyReport";
import { buildEarningsReportPdf } from "@/lib/pdfReport";
import { sendTelegramDocument } from "@/lib/telegramBot";
import {
  isMondayInAlmaty,
  isFirstOfMonthInAlmaty,
  lastWeekRangeAlmaty,
  lastMonthRangeAlmaty,
} from "@/lib/timezone";

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
    weeklyReportSent: false,
    monthlyReportSent: false,
  };

  try {
    summary.birthdays = await processBirthdaysToday();
  } catch (err) {
    console.error("[cron] birthday check failed:", err);
  }

  try {
    await resetGuestAccount();
    summary.guestReset = true;
  } catch (err) {
    console.error("[cron] guest reset failed:", err);
  }

  // Отчёты шлём туда же, где команда видит объявления бота, и обязательно
  // с номером темы: без него файл уходит в «General», и его никто не
  // читает — поэтому отчётов «давно не было».
  const reportChatId =
    process.env.TELEGRAM_ANNOUNCE_CHAT_ID ?? process.env.TELEGRAM_GROUP_CHAT_ID;
  const reportThreadId = process.env.TELEGRAM_ANNOUNCE_THREAD_ID
    ? Number(process.env.TELEGRAM_ANNOUNCE_THREAD_ID)
    : undefined;

  if (reportChatId && isMondayInAlmaty()) {
    try {
      const { start, end, label } = lastWeekRangeAlmaty();
      const rows = await getEarningsForRange({ start, end });
      const pdf = await buildEarningsReportPdf({
        title: `Отчёт PactoCoins — неделя ${label}`,
        rows,
      });
      await sendTelegramDocument(
        reportChatId,
        pdf,
        `pactocoins-week-${label}.pdf`,
        `📊 Отчёт за неделю ${label}`,
        "application/pdf",
        reportThreadId
      );
      summary.weeklyReportSent = true;
    } catch (err) {
      console.error("[cron] weekly report failed:", err);
    }
  }

  if (reportChatId && isFirstOfMonthInAlmaty()) {
    try {
      const { start, end, label } = lastMonthRangeAlmaty();
      const rows = await getEarningsForRange({ start, end });
      const pdf = await buildEarningsReportPdf({
        title: `Отчёт PactoCoins — ${label}`,
        rows,
      });
      await sendTelegramDocument(
        reportChatId,
        pdf,
        `pactocoins-${label.replace(" ", "-")}.pdf`,
        `📊 Отчёт за ${label}`,
        "application/pdf",
        reportThreadId
      );
      summary.monthlyReportSent = true;
    } catch (err) {
      console.error("[cron] monthly report failed:", err);
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
