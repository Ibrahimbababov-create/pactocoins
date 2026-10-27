import { NextResponse } from "next/server";
import { runHeldReports } from "@/lib/heldReports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Запускается в 05:00 UTC = 10:00 по Алматы. Недельный отчёт (понедельник)
// и месячный (1-е число) уходят не раньше этого часа и только когда за период
// нет необработанных заявок на выручку; иначе админу раз в сутки приходит
// напоминание (lib/heldReports.js).
export async function GET(request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runHeldReports({ remind: true })) });
  } catch (err) {
    console.error("[cron] reports failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
