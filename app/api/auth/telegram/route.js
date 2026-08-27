import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase-admin";
import { validateTelegramInitData, derivePassword } from "@/lib/telegram";
import { sendTelegramMessage } from "@/lib/telegramBot";

// Отдельная группа/топик, куда падают заявки на регистрацию новых
// аккаунтов — не то же самое, что общая группа заявок на выручку.
const JOIN_REQUEST_CHAT_ID = -1004323139236;
const JOIN_REQUEST_THREAD_ID = 99;

export async function POST(request) {
  const { initData, displayName, birthday } = await request.json();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  // ДР необязателен; принимаем только строгий YYYY-MM-DD, иначе игнорируем
  const cleanBirthday =
    typeof birthday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(birthday)
      ? birthday
      : null;

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
        birthday: cleanBirthday,
      })
      .select("id")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    await sendTelegramMessage(
      JOIN_REQUEST_CHAT_ID,
      `🙋 <b>Заявка на регистрацию</b>\n\nИмя: <b>${name}</b>\nTelegram: ${
        tgUser.username ? `@${tgUser.username}` : `id ${tgUser.id}`
      }${cleanBirthday ? `\nДР: ${cleanBirthday}` : ""}`,
      {
        inline_keyboard: [
          [
            { text: "✅ Принять", callback_data: `approve_join:${joinRequest.id}` },
            { text: "❌ Отклонить", callback_data: `reject_join:${joinRequest.id}` },
          ],
        ],
      },
      JOIN_REQUEST_THREAD_ID
    );

    // Аккаунта пока нет — сессию не открываем, просто сообщаем что
    // заявка ушла на рассмотрение.
    return NextResponse.json({ pending: true });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  // Уволен — не пускаем обратно, даже если пароль/сессия ещё технически
  // валидны. Сразу разлогиниваем, чтобы сессия не висела в браузере.
  if (profile?.is_active === false) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "account_deactivated" }, { status: 403 });
  }

  const response = NextResponse.json({
    redirect: profile?.role === "admin" ? "/admin" : "/mop",
  });

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set({ name, value, ...options });
  });

  return response;
}
