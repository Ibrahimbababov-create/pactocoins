"use client";

// Тактильная отдача через Telegram WebApp. Вне Telegram (обычный
// браузер) — просто ничего не делает. Ошибки глотаем: на части старых
// клиентов методов может не быть.
function hf() {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp?.HapticFeedback ?? null;
}

export const haptic = {
  light() {
    try {
      hf()?.impactOccurred("light");
    } catch {}
  },
  medium() {
    try {
      hf()?.impactOccurred("medium");
    } catch {}
  },
  heavy() {
    try {
      hf()?.impactOccurred("heavy");
    } catch {}
  },
  success() {
    try {
      hf()?.notificationOccurred("success");
    } catch {}
  },
  warning() {
    try {
      hf()?.notificationOccurred("warning");
    } catch {}
  },
  error() {
    try {
      hf()?.notificationOccurred("error");
    } catch {}
  },
  select() {
    try {
      hf()?.selectionChanged();
    } catch {}
  },
};
