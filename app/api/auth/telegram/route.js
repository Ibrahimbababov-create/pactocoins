import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase-admin";
import { validateTelegramInitData, derivePassword } from "@/lib/telegram";

export async function POST(request) {
  const { initData } = await request.json();
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

  // Первый вход этого пользователя — создаём аккаунт автоматически
  if (signInError) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }

    const name =
      [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") ||
      tgUser.username ||
      "МОП";

    await admin.from("users").insert({
      id: created.user.id,
      name,
      email,
      role: "mop",
      balance: 0,
      total_earned: 0,
      month_earned: 0,
    });

    const retry = await supabase.auth.signInWithPassword({ email, password });
    if (retry.error) {
      return NextResponse.json({ error: retry.error.message }, { status: 500 });
    }
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
