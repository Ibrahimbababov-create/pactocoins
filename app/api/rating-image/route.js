import { createAdminClient } from "@/lib/supabase-admin";
import { renderRatingImage } from "@/lib/ratingImage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Картинка рейтинга (для предпросмотра / внешних вызовов).
// Гейт по DEV_LOGIN_SECRET. Бот шлёт картинку не через этот роут,
// а напрямую через lib/ratingImage.
export async function GET(request) {
  const secret = process.env.DEV_LOGIN_SECRET;
  const url = new URL(request.url);
  if (!secret || url.searchParams.get("secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  const period = url.searchParams.get("period") === "month" ? "month" : "week";

  try {
    const png = await renderRatingImage(createAdminClient(), period);
    return new Response(png, {
      headers: { "content-type": "image/png", "cache-control": "no-store" },
    });
  } catch (e) {
    console.error("[rating-image]", e);
    return new Response(`error: ${e.message}\n${e.stack || ""}`, {
      status: 500,
    });
  }
}
