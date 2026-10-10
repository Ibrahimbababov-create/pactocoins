import { createAdminClient } from "@/lib/supabase-admin";

// Единый список команд бота (виден по "/" везде: личка, группы, всем).
// Берём то, что уже стоит в default-scope (команды sales-bot), убираем
// ненужные, добавляем свои. Узкие scope (личные чаты, админы групп)
// чистим, чтобы всё падало на этот общий список.
// /rating и /rating_month убраны из меню по просьбе Ибрагима (есть /top5
// и /topall); у админов они по-прежнему работают, если набрать вручную.
export const BOT_COMMANDS = [
  { command: "top5", description: "Топ-5 менеджеров за месяц" },
  { command: "topall", description: "Все менеджеры за месяц" },
  { command: "topteam", description: "Топ команд за месяц" },
  { command: "today", description: "Оплаты за сегодня по менеджерам" },
  { command: "todayteam", description: "Оплаты за сегодня по командам" },
  { command: "app", description: "Открыть приложение PactoCoins" },
  { command: "all", description: "Тегнуть всех в чате" },
  { command: "report", description: "Отчёт за прошлую неделю (PDF)" },
  { command: "report_month", description: "Отчёт за прошлый месяц (PDF)" },
  { command: "chatid", description: "ID этого чата" },
];
const REMOVE = new Set(["checkplan", "rating", "rating_week", "rating_month"]);

export async function syncBotCommands() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { error: "no bot token" };

  const tg = (method, body) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }).then((r) => r.json());

  // 1) Общий default-список: чужие команды (sales-bot) оставляем, наши — по списку.
  const existing = (await tg("getMyCommands"))?.result ?? [];
  const ours = new Set(BOT_COMMANDS.map((c) => c.command));
  const merged = [
    ...BOT_COMMANDS,
    ...existing.filter((c) => !REMOVE.has(c.command) && !ours.has(c.command)),
  ];
  const setDefault = await tg("setMyCommands", { commands: merged });

  // 2) Чистим узкие scope, чтобы они не перекрывали общий список.
  const admin = createAdminClient();
  const { data: admins } = await admin
    .from("users")
    .select("telegram_id")
    .eq("role", "admin")
    .not("telegram_id", "is", null);
  for (const a of admins ?? []) {
    await tg("deleteMyCommands", { scope: { type: "chat", chat_id: a.telegram_id } });
  }
  await tg("deleteMyCommands", { scope: { type: "all_chat_administrators" } });

  return {
    before: existing.map((c) => c.command),
    after: merged.map((c) => c.command),
    ok: Boolean(setDefault?.ok),
  };
}
