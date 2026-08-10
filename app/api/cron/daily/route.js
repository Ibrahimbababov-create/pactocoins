import { NextResponse } from "next/server";
import { processBirthdaysToday } from "@/lib/birthdayBonus";
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
    weeklyReportSent: false,
    monthlyReportSent: false,
  };

  try {
    summary.birthdays = await processBirthdaysToday();
  } catch (err) {
    console.error("[cron] birthday check failed:", err);
  }

  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;

  if (groupChatId && isMondayInAlmaty()) {
    try {
      const { start, end, label } = lastWeekRangeAlmaty();
      const rows = await getEarningsForRange({ start, end });
      const pdf = await buildEarningsReportPdf({
        title: `Отчёт PactoCoins — неделя ${label}`,
        rows,
      });
      await sendTelegramDocument(
        groupChatId,
        pdf,
        `pactocoins-week-${label}.pdf`,
        `📊 Отчёт за неделю ${label}`,
        "application/pdf"
      );
      summary.weeklyReportSent = true;
    } catch (err) {
      console.error("[cron] weekly report failed:", err);
    }
  }

  if (groupChatId && isFirstOfMonthInAlmaty()) {
    try {
      const { start, end, label } = lastMonthRangeAlmaty();
      const rows = await getEarningsForRange({ start, end });
      const pdf = await buildEarningsReportPdf({
        title: `Отчёт PactoCoins — ${label}`,
        rows,
      });
      await sendTelegramDocument(
        groupChatId,
        pdf,
        `pactocoins-${label.replace(" ", "-")}.pdf`,
        `📊 Отчёт за ${label}`,
        "application/pdf"
      );
      summary.monthlyReportSent = true;
    } catch (err) {
      console.error("[cron] monthly report failed:", err);
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
