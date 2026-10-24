"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function TelegramInit({ bgColor = "#07080a" }) {
  const pathname = usePathname();
  const router = useRouter();

  // Кнопка «Инструкция» в группе открывает приложение с start_param=help.
  // Уже вошедшего сервер сразу кладёт на главный — отсюда переводим на
  // инструкцию, один раз за открытие. Не вошедшего доведёт /login.
  useEffect(() => {
    const startParam = window?.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (startParam !== "help" || !pathname?.startsWith("/mop")) return;
    try {
      if (sessionStorage.getItem("pc-start-help")) return;
      sessionStorage.setItem("pc-start-help", "1");
    } catch {}
    if (pathname !== "/mop/help") router.replace("/mop/help");
  }, [pathname, router]);

  useEffect(() => {
    const tg = window?.Telegram?.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
    if (typeof tg.disableVerticalSwipes === "function") {
      tg.disableVerticalSwipes();
    }
    // Шапку, фон окна и нижнюю системную полосу красим в фон темы. Без
    // этого у тех, у кого Telegram в светлой теме, под тёмным приложением
    // висела белая полоса снизу и белые вспышки при прокрутке за край.
    const atLeast = (v) =>
      typeof tg.isVersionAtLeast === "function" ? tg.isVersionAtLeast(v) : false;
    const paint = (method, minVersion) => {
      if (typeof tg[method] !== "function" || !atLeast(minVersion)) return;
      try {
        tg[method](bgColor);
      } catch {}
    };
    paint("setHeaderColor", "6.1");
    paint("setBackgroundColor", "6.1");
    paint("setBottomBarColor", "7.10");
  }, [bgColor]);

  return null;
}
