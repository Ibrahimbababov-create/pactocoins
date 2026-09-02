export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = "https://pactocoins.vercel.app";

// GET /api/telegram/set-menu-button?secret=<DEV_LOGIN_SECRET>
// Ставит кнопку-меню бота (слева от поля ввода в чате с ботом) на запуск
// мини-приложения. Один раз — дальше висит у всех.
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

  const me = await tg("getMe");
  const setBtn = await tg("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Открыть PactoCoins",
      web_app: { url: APP_URL },
    },
  });

  const username = me?.result?.username ?? null;
  return Response.json({
    username,
    directLink: username ? `https://t.me/${username}?startapp` : null,
    setBtn,
  });
}
