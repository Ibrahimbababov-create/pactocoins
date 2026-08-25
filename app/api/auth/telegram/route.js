import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase-admin";
import { validateTelegramInitData, derivePassword } from "@/lib/telegram";
import { sendTelegramMessage } from "@/lib/telegramBot";

export async function POST(request) {
  const { initData, displayName } = await request.json();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  const tgUser = validateTelegramInitData(initData, botToken);
  if (!tgUser) {
    return NextResponse.json({ error: "invalid_init_data" }, { status: 401 });
  }

  const email = `tg${tgUser.id}@pactocoins.local`;
  const password = derivePassword(tgUser.id, botToken);
  const admin = createAdminClient();
  const cookieStore = cookies();
  const cookiesToSet = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookiesToSet.push({ name, value, options }),
        remove: (name, options) => cookiesToSet.push({ name, value: "", options }),
      },
    }
  );

  let { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // Первый вход этого пользователя — аккаунта ещё нет.
  if (signInError) {
    // Уже подавал заявку и она на рассмотрении — не спрашиваем повторно
    const { data: existingRequest } = await admin
      .from("join_requests")
      .select("status")
      .eq("telegram_id", tgUser.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRequest?.status === "pending") {
      return NextResponse.json({ pending: true });
    }

    // Ещё не выбрали имя — просим клиент показать экран приветствия
    // (гость / регистрация).
    if (!displayName) {
      return NextResponse.json({ needsOnboarding: true });
    }

    const name = displayName.trim().slice(0, 60) || "МОП";

    const { data: joinRequest, error: insertErr } = await admin
      .from("join_requests")
      .insert({
        telegram_id: tgUser.id,
        telegram_username: tgUser.username || null,
        name,
      })
      .select("id")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
    if (groupChatId) {
      const threadId = process.env.TELEGRAM_REQUESTS_THREAD_ID
        ? Number(process.env.TELEGRAM_REQUESTS_THREAD_ID)
        : undefined;

      await sendTelegramMessage(
        groupChatId,
        `🙋 <b>Заявка на регистрацию</b>\n\nИмя: <b>${name}</b>\nTelegram: ${
          tgUser.username ? `@${tgUser.username}` : `id ${tgUser.id}`
        }`,
        {
          inline_keyboard: [
            [
              { text: "✅ Принять", callback_data: `approve_join:${joinRequest.id}` },
              { text: "❌ Отклонить", callback_data: `reject_join:${joinRequest.id}` },
            ],
          ],
        },
        threadId
      );
    }

    // Аккаунта пока нет — сессию не открываем, просто сообщаем что
    // заявка ушла на рассмотрение.
    return NextResponse.json({ pending: true });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const response = NextResponse.json({
    redirect: profile?.role === "admin" ? "/admin" : "/mop",
  });

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set({ name, value, ...options });
  });

  return response;
}
