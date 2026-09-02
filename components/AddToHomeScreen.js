"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";

// Кнопка «добавить иконку приложения на главный экран телефона».
// Работает в Telegram 8.0+ (метод addToHomeScreen). Где не поддерживается —
// просто ничего не показываем.
export default function AddToHomeScreen() {
  const [state, setState] = useState("hidden"); // hidden | offer | added

  useEffect(() => {
    const tg = window?.Telegram?.WebApp;
    if (!tg || typeof tg.addToHomeScreen !== "function") return;

    if (typeof tg.checkHomeScreenStatus === "function") {
      try {
        tg.checkHomeScreenStatus((status) => {
          if (status === "added") setState("added");
          else if (status === "unsupported") setState("hidden");
          else setState("offer");
        });
      } catch {
        setState("offer");
      }
    } else {
      setState("offer");
    }

    const onAdded = () => setState("added");
    tg.onEvent?.("homeScreenAdded", onAdded);
    return () => tg.offEvent?.("homeScreenAdded", onAdded);
  }, []);

  if (state === "hidden") return null;

  if (state === "added") {
    return (
      <p className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-500">
        <Icon name="check" className="w-5 h-5 shrink-0 text-acid-400" />
        Иконка на главном экране
      </p>
    );
  }

  return (
    <button
      onClick={() => {
        try {
          window.Telegram.WebApp.addToHomeScreen();
        } catch {}
      }}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-acid-400 hover:bg-dark-700 transition"
    >
      <Icon name="phone" className="w-5 h-5 shrink-0" />
      Вывести иконку на телефон
    </button>
  );
}
