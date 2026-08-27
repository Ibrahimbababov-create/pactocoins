"use client";

import { useEffect, useRef, useState } from "react";

// Число, которое "прокручивается" от прошлого значения к новому.
// Прошлое значение берём из localStorage по storageKey — тогда прокрутка
// идёт при реальном изменении (после покупки/начисления), а не только
// при первой загрузке. Без storageKey крутит от 0 при каждом маунте.
export default function AnimatedNumber({
  value,
  storageKey,
  duration = 700,
  format = true,
  className,
}) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef(null);

  useEffect(() => {
    const persist = () => {
      if (storageKey && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(storageKey, String(value));
        } catch {
          // приватный режим и т.п. — просто не сохраняем
        }
      }
    };

    let from = 0;
    if (storageKey && typeof window !== "undefined") {
      try {
        const saved = Number(window.localStorage.getItem(storageKey));
        if (Number.isFinite(saved)) from = saved;
      } catch {
        from = 0;
      }
    }

    if (from === value) {
      setDisplay(value);
      persist();
      return;
    }

    setDisplay(from);
    const start = performance.now();
    const delta = value - from;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + delta * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
        persist();
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, storageKey, duration]);

  const shown = format ? display.toLocaleString("ru-RU") : String(display);
  return <span className={className}>{shown}</span>;
}
