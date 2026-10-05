import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

function homeForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "observer") return "/observer";
  return "/mop";
}

export async function middleware(request) {
  const path = request.nextUrl.pathname;

  // Адрес страницы прокидываем в приложение заголовком: корневой layout
  // по нему понимает, что он уже на /login, и не отправляет туда же по
  // второму кругу.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", path);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = path === "/login";
  const isAdminPage = path.startsWith("/admin");
  // Наставник ведёт обучение стажёров, поэтому ему открыт раздел
  // «Обучение» в админке — и только он.
  const isOnboardingAdminPage = path.startsWith("/admin/onboarding");
  const isObserverPage = path.startsWith("/observer");
  // Гость нажал «выйти» — ему нужен экран выбора, даже если сессия
  // технически ещё не успела очиститься. Не редиректим его с /login.
  const forceWelcome =
    isLoginPage && request.nextUrl.searchParams.get("welcome") === "1";

  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // За ролью ходим только там, где доступ зависит от самого адреса:
  // админка, кабинет наблюдателя и вход. На всех остальных страницах
  // этот запрос не делаем — проверка живёт на ближайшем к человеку
  // сервере (для Казахстана это Франкфурт), а база стоит в Токио, и
  // каждое такое обращение стоило примерно полсекунды на открытие.
  // Уволенных отсекает корневой layout: он и так читает профиль, но
  // работает рядом с базой, где это почти бесплатно.
  const needsProfile = isLoginPage || isAdminPage || isObserverPage;

  if (user && needsProfile) {
    const { data: profile } = await supabase
      .from("users")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    // Уволенный сотрудник (is_active = false) не должен пользоваться
    // приложением, даже если сессия входа технически ещё жива.
    if (profile?.is_active === false && !isLoginPage) {
      return NextResponse.redirect(new URL("/login?deactivated=1", request.url));
    }

    if (isLoginPage) {
      if (profile?.is_active === false || forceWelcome) {
        return response;
      }
      // Кнопка «Инструкция» из лички с ботом: /login?next=help
      if (request.nextUrl.searchParams.get("next") === "help") {
        return NextResponse.redirect(new URL("/mop/help", request.url));
      }
      return NextResponse.redirect(
        new URL(homeForRole(profile?.role), request.url)
      );
    }

    if (
      isAdminPage &&
      profile?.role !== "admin" &&
      !(isOnboardingAdminPage && profile?.role === "mentor")
    ) {
      return NextResponse.redirect(
        new URL(homeForRole(profile?.role), request.url)
      );
    }

    if (
      isObserverPage &&
      profile?.role !== "observer" &&
      profile?.role !== "admin"
    ) {
      return NextResponse.redirect(
        new URL(homeForRole(profile?.role), request.url)
      );
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
