import { NextResponse } from "next/server";
import { runHeldReports } from "@/lib/heldReports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Вызывается после обработки заявки на выручку: отправляет отложенный
// отчёт, если необработанных заявок за период не осталось.
export async function POST(request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runHeldReports({ remind: false })) });
  } catch (err) {
    console.error("[reports] held route failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
