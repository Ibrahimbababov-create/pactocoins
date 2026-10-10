import { syncBotCommands } from "@/lib/botCommands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ручное обновление меню команд бота. То же самое делает ежедневный крон
// и админская команда /syncmenu в боте. Список — lib/botCommands.js.
export async function GET(request) {
  const secret = process.env.DEV_LOGIN_SECRET;
  const url = new URL(request.url);
  if (!secret || url.searchParams.get("secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  return Response.json(await syncBotCommands());
}
