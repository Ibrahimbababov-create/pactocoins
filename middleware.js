import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

function homeForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "observer") return "/observer";
  return "/mop";
}

export async function middleware(request) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLoginPage = path === "/login";
  const isAdminPage = path.startsWith("/admin");
  const isObserverPage = path.startsWith("/observer");

  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    // Уволенный сотрудник (is_active = false) не должен пользоваться
    // приложением, даже если сессия входа технически ещё жива —
    // проверяем это на каждом защищённом переходе, не только на входе.
    if (profile?.is_active === false && !isLoginPage) {
      return NextResponse.redirect(new URL("/login?deactivated=1", request.url));
    }

    if (isLoginPage) {
      if (profile?.is_active === false) {
        return response;
      }
      return NextResponse.redirect(
        new URL(homeForRole(profile?.role), request.url)
      );
    }

    if (isAdminPage && profile?.role !== "admin") {
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
