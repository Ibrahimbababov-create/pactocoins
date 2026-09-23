"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { THEMES } from "@/lib/themes";
import { setMyTheme } from "@/app/admin/themeActions";
import { haptic } from "@/lib/haptics";
import Icon from "@/components/Icon";

export default function ThemePicker({ current = "acid" }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [picked, setPicked] = useState(current);
  const [error, setError] = useState(null);

  function choose(key) {
    if (key === picked || isPending) return;
    const previous = picked;
    setPicked(key);
    setError(null);
    haptic.light();

    // Красим страницу сразу, не дожидаясь сервера — так выбор ощущается
    // мгновенным. Если сервер откажет, вернём как было.
    document.documentElement.dataset.theme = key;

    startTransition(async () => {
      const res = await setMyTheme(key);
      if (res?.error) {
        setPicked(previous);
        document.documentElement.dataset.theme = previous;
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-2xl p-4">
      <p className="text-sm text-gray-500">Тема оформления</p>

      <div className="grid grid-cols-2 gap-2 mt-3">
        {Object.entries(THEMES).map(([key, theme]) => {
          const active = picked === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => choose(key)}
              disabled={isPending}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition active:scale-[0.98] ${
                active
                  ? "border-acid-400 bg-acid-400/10"
                  : "border-dark-600 bg-dark-900/40"
              }`}
            >
              <span
                className="w-9 h-9 shrink-0 rounded-full border border-white/10"
                style={{
                  background: `linear-gradient(135deg, ${theme.swatch[0]} 0 50%, ${theme.swatch[1]} 50% 100%)`,
                }}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold truncate">
                  {theme.label}
                </span>
                <span className="block text-xs text-gray-500 truncate">
                  {theme.hint}
                </span>
              </span>
              {active && (
                <Icon
                  name="check"
                  className="w-4 h-4 ml-auto shrink-0 text-acid-400"
                  strokeWidth={2.5}
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-600 mt-3">
        Меняется только у тебя. Сотрудникам темы откроем со второго уровня.
      </p>

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
