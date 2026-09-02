import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Единый список команд бота (виден по "/" везде: личка, группы, всем).
// Берём то, что уже стоит в default-scope (команды sales-bot), убираем
// ненужные, добавляем свои. Узкие scope (личные чаты, админы групп)
// чистим, чтобы всё падало на этот общий список.
// Полный список команд бота для меню "/". checkplan намеренно нет.
const ADD = [
  { command: "app", description: "Открыть приложение PactoCoins" },
  { command: "all", description: "Тегнуть всех в чате" },
  { command: "rating", description: "Рейтинг за неделю (картинка)" },
  { command: "rating_month", description: "Рейтинг за месяц (картинка)" },
  { command: "top5", description: "Топ-5 менеджеров по продажам" },
  { command: "topall", description: "Топ всех менеджеров" },
  { command: "topteam", description: "Топ по командам" },
  { command: "chatid", description: "ID этого чата" },
];
const REMOVE = new Set(["checkplan"]);

export async function GET(request) {
  const secret = process.env.DEV_LOGIN_SECRET;
  const url = new URL(request.url);
  if (!secret || url.searchParams.get("secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return new Response("no bot token", { status: 500 });

  const tg = (method, body) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }).then((r) => r.json());

  // 1) Собираем общий default-список
  const existing = (await tg("getMyCommands"))?.result ?? [];
  const addCmds = new Set(ADD.map((c) => c.command));
  const merged = [
    ...existing.filter(
      (c) => !REMOVE.has(c.command) && !addCmds.has(c.command)
    ),
    ...ADD,
  ];
  const setDefault = await tg("setMyCommands", { commands: merged });

  // 2) Чистим узкие scope, чтобы они не перекрывали общий список
  const admin = createAdminClient();
  const { data: admins } = await admin
    .from("users")
    .select("telegram_id")
    .eq("role", "admin")
    .not("telegram_id", "is", null);

  const cleaned = [];
  for (const a of admins ?? []) {
    cleaned.push(
      await tg("deleteMyCommands", {
        scope: { type: "chat", chat_id: a.telegram_id },
      })
    );
  }
  const cleanedAdmins = await tg("deleteMyCommands", {
    scope: { type: "all_chat_administrators" },
  });

  return Response.json({
    before: existing.map((c) => c.command),
    after: merged.map((c) => c.command),
    setDefault,
    cleanedChatScopes: cleaned.length,
    cleanedAdmins,
  });
}
