"use client";

import { useEffect, useRef, useState } from "react";

// Число, которое "прокручивается" от 0 к текущему значению при каждом
// появлении на экране — как проценты на кольце цели. Без библиотек.
export default function AnimatedNumber({
  value,
  duration = 700,
  format = true,
  className,
}) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef(null);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }

    setDisplay(0);
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const shown = format ? display.toLocaleString("ru-RU") : String(display);
  return <span className={className}>{shown}</span>;
}
