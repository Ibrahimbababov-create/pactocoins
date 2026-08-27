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

  const tg = (method, body) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  const results = [];

  // 1) Личные чаты админов
  for (const a of admins ?? []) {
    results.push({
      scope: `chat ${a.name}`,
      tg: await tg("setMyCommands", {
        commands: CMDS,
        scope: { type: "chat", chat_id: a.telegram_id },
      }),
    });
  }

  // 2) Админы во всех группах — мержим с тем, что уже там (не затираем
  //    команды sales-bot, если он их туда клал).
  const scope = { type: "all_chat_administrators" };
  const existing = await tg("getMyCommands", { scope });
  const mine = new Set(CMDS.map((c) => c.command));
  const merged = [
    ...(existing?.result ?? []).filter((c) => !mine.has(c.command)),
    ...CMDS,
  ];
  results.push({
    scope: "all_chat_administrators",
    kept: (existing?.result ?? []).length,
    tg: await tg("setMyCommands", { commands: merged, scope }),
  });

  return Response.json({ count: results.length, results });
}
