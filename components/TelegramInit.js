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
    if (typeof tg.setHeaderColor === "function") {
      try {
        tg.setHeaderColor(bgColor);
      } catch {}
    }
  }, [bgColor]);

  return null;
}
