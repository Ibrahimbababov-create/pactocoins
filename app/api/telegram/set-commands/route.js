import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Регистрирует команды рейтинга в меню бота — точечно, только в личных
// чатах админов (scope chat), чтобы не трогать общий список команд,
// которым управляет sales-bot.
const CMDS = [
  { command: "rating", description: "Рейтинг за неделю (картинка)" },
  { command: "rating_month", description: "Рейтинг за месяц (картинка)" },
];

export async function GET(request) {
  const secret = process.env.DEV_LOGIN_SECRET;
  const url = new URL(request.url);
  if (!secret || url.searchParams.get("secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return new Response("no bot token", { status: 500 });

  const admin = createAdminClient();
  const { data: admins } = await admin
    .from("users")
    .select("telegram_id, name")
    .eq("role", "admin")
    .not("telegram_id", "is", null);

  const results = [];
  for (const a of admins ?? []) {
    const r = await fetch(
      `https://api.telegram.org/bot${token}/setMyCommands`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commands: CMDS,
          scope: { type: "chat", chat_id: a.telegram_id },
        }),
      }
    );
    results.push({ name: a.name, chat_id: a.telegram_id, tg: await r.json() });
  }

  return Response.json({ count: results.length, results });
}
