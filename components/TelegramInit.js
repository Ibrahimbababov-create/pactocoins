"use client";

import { useEffect } from "react";

export default function TelegramInit({ bgColor = "#07080a" }) {
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
