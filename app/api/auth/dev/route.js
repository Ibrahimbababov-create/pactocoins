import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase-admin";

// Служебный вход под тестовыми ролями — только для проверки интерфейса.
// Полностью выключен, пока в окружении не задан DEV_LOGIN_SECRET.
// Работает исключительно с аккаунтами *.test@pactocoins.local, реальных
// пользователей не трогает.

export const dynamic = "force-dynamic";

const ROLE_HOME = {
  mop: "/mop",
  rop: "/mop",
  admin: "/admin",
  observer: "/observer",
};

function devPassword() {
  return `dev-${(process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback").slice(0, 32)}`;
}

async function findAuthUserId(admin, email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) return null;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

export async function GET(request) {
  const secret = process.env.DEV_LOGIN_SECRET;
  if (!secret || secret.length < 16) {
    return new NextResponse("not found", { status: 404 });
  }

  const url = new URL(request.url);
  const given = url.searchParams.get("secret") || "";
  const role = url.searchParams.get("role") || "mop";

  if (given.length !== secret.length || given !== secret) {
    return new NextResponse("forbidden", { status: 403 });
  }
  if (!ROLE_HOME[role]) {
    return new NextResponse("bad role (mop|rop|admin|observer)", {
      status: 400,
    });
  }

  const email = `${role}.test@pactocoins.local`;
  const password = devPassword();
  const admin = createAdminClient();

  // 1. Auth-пользователь: находим по профилю, иначе создаём. Пароль
  //    всегда переустанавливаем — он детерминированный от service-ключа.
  let userId = null;
  const { data: profileRow } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (profileRow) {
    userId = profileRow.id;
  } else {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (created?.user) {
      userId = created.user.id;
    } else {
      // возможно auth-пользователь уже есть, а строки в users нет
      userId = await findAuthUserId(admin, email);
      if (!userId) {
        return new NextResponse(
          `create failed: ${createErr?.message ?? "unknown"}`,
          { status: 500 }
        );
      }
    }
  }

  await admin.auth.admin.updateUserById(userId, { password });

  // 2. Профиль с нужной ролью — самовосстанавливается при каждом входе.
  const { error: upsertErr } = await admin.from("users").upsert(
    {
      id: userId,
      email,
      name: `🤖 Claude TEST (${role})`,
      role,
      is_active: true,
      is_guest: false,
    },
    { onConflict: "id" }
  );
  if (upsertErr) {
    return new NextResponse(`profile failed: ${upsertErr.message}`, {
      status: 500,
    });
  }

  // 3. Серверный вход, куки на ответ, редирект по роли.
  const cookieStore = cookies();
  const cookiesToSet = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) =>
          cookiesToSet.push({ name, value, options }),
        remove: (name, options) =>
          cookiesToSet.push({ name, value: "", options }),
      },
    }
  );

  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) {
    return new NextResponse(`signin failed: ${signInErr.message}`, {
      status: 500,
    });
  }

  const response = NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set({ name, value, ...options });
  });
  return response;
}
