import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendTelegramMessage } from "@/lib/telegramBot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Подсказка про иконку на рабочем столе. Приходит каждому один раз:
// новичку — через час после регистрации, всем остальным — в первый же
// запуск после выкладки. Уволенных не трогаем.
const TIP_TEXT = `📱 <b>Вынеси PactoCoins на экран телефона</b>

Чтобы не искать бота в переписках каждый раз: открой меню бота (три точки справа сверху) → «Вывести иконку на телефон». На рабочем столе появится обычная иконка, как у любого приложения.

А пока открыть можно кнопкой ниже.`;

const KEYBOARD = {
  inline_keyboard: [
    [
      {
        text: "🚀 Открыть PactoCoins",
        web_app: { url: "https://pactocoins.vercel.app" },
      },
    ],
  ],
};

export async function GET(request) {
  const secret = process.env.TIPS_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: users, error } = await admin
    .from("users")
    .select("id, telegram_id")
    .is("home_screen_tip_sent_at", null)
    .not("telegram_id", "is", null)
    .eq("is_active", true)
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local")
    .lte("created_at", hourAgo)
    .limit(60);

  if (error) {
    console.error("[tips] выборка не удалась:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const u of users ?? []) {
    try {
      await sendTelegramMessage(u.telegram_id, TIP_TEXT, KEYBOARD);
      sent++;
    } catch (err) {
      // Человек мог не нажать «старт» у бота — Telegram такому не доставит.
      // Это не повод слать ему каждый час, поэтому всё равно помечаем.
      failed++;
      console.error("[tips] не доставлено", u.id, err?.message);
    }
    await admin
      .from("users")
      .update({ home_screen_tip_sent_at: new Date().toISOString() })
      .eq("id", u.id);
  }

  return NextResponse.json({ ok: true, sent, failed });
}
