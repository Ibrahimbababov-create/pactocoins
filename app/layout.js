import Script from "next/script";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { Unbounded, Onest } from "next/font/google";
import "./globals.css";
import TelegramInit from "@/components/TelegramInit";
import { createClient } from "@/lib/supabase-server";
import { DEFAULT_THEME, themeOrDefault, themeStyleSheet, themeBgHex } from "@/lib/themes";

// Тему читаем на сервере и ставим атрибутом на <html>: страница сразу
// приходит в нужном цвете, без мигания «сначала одна тема, потом другая».
// Заодно отсюда же проверяем, не уволен ли человек: профиль всё равно
// читается, а этот сервер стоит рядом с базой — в отличие от проверки
// доступа перед страницей, которая живёт на другом конце света.
async function currentProfile() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { theme: DEFAULT_THEME, deactivated: false };
    const { data } = await supabase
      .from("users")
      .select("theme, is_active")
      .eq("id", user.id)
      .single();
    return {
      theme: themeOrDefault(data?.theme),
      deactivated: data?.is_active === false,
    };
  } catch {
    return { theme: DEFAULT_THEME, deactivated: false };
  }
}

// Unbounded — цифры, заголовки, логотип. Onest — весь остальной текст.
const unbounded = Unbounded({
  subsets: ["cyrillic", "latin"],
  weight: ["700", "800"],
  variable: "--font-unbounded",
  display: "swap",
});

const onest = Onest({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-onest",
  display: "swap",
});

export const metadata = {
  title: "PactoCoins",
  description: "Внутренняя система коинов отдела продаж",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }) {
  const { theme, deactivated } = await currentProfile();

  // На самом /login разворачивать некуда — иначе получится круг.
  const path = headers().get("x-pathname") ?? "";
  if (deactivated && path !== "/login") {
    redirect("/login?deactivated=1");
  }

  return (
    <html
      lang="ru"
      data-theme={theme}
      className={`${unbounded.variable} ${onest.variable}`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeStyleSheet() }} />
      </head>
      <body>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <TelegramInit bgColor={themeBgHex(theme)} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
