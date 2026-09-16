export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = "https://pactocoins.vercel.app";

// GET /api/telegram/set-webhook  с заголовком  x-setup-secret: <TELEGRAM_WEBHOOK_SECRET>
// Прописывает вебхук в Telegram вместе с секретным токеном — после этого
// Telegram подписывает им каждый свой запрос, а /api/telegram/webhook
// отвергает всё, что пришло без правильной подписи.
// Дёргается вручную один раз после смены секрета.
//
// Секрет принимаем только заголовком, а не в адресе: адреса оседают в логах
// Vercel, в истории браузера и в реферерах, заголовки — нет.
export async function GET(request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!secret || secret.length < 16) {
    return new Response("TELEGRAM_WEBHOOK_SECRET не задан", { status: 500 });
  }
  if (request.headers.get("x-setup-secret") !== secret) {
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

  // Сохраняем текущий набор типов апдейтов как есть — задача этого роута
  // только добавить секрет, ничего больше в поведении бота менять не надо.
  const before = await tg("getWebhookInfo");
  const keepAllowed = before?.result?.allowed_updates;

  const setResult = await tg("setWebhook", {
    url: `${APP_URL}/api/telegram/webhook`,
    secret_token: secret,
    ...(Array.isArray(keepAllowed) && keepAllowed.length
      ? { allowed_updates: keepAllowed }
      : {}),
    // Накопившиеся апдейты не сбрасываем — иначе потеряем нажатия,
    // которые прилетели, пока деплой катился.
  });

  const info = await tg("getWebhookInfo");

  return Response.json({
    setResult,
    // Секрет сам Telegram обратно не отдаёт — только флаг, что он выставлен.
    webhookInfo: info?.result ?? info,
  });
}
