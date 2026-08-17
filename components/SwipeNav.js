"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const TAB_ORDER = ["/mop", "/mop/rating", "/mop/history", "/mop/shop"];

const SWIPE_MIN_DISTANCE = 60;
const SWIPE_DIRECTION_RATIO = 1.8; // насколько горизонталь должна доминировать над вертикалью
const EDGE_EXCLUSION = 24; // не спорим с системным свайпом "назад" по краю экрана

export default function SwipeNav({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [animClass, setAnimClass] = useState("");
  const prevIndexRef = useRef(TAB_ORDER.indexOf(pathname));
  const touchRef = useRef(null);

  useEffect(() => {
    const newIndex = TAB_ORDER.indexOf(pathname);
    const prevIndex = prevIndexRef.current;

    if (newIndex !== -1 && prevIndex !== -1 && newIndex !== prevIndex) {
      setAnimClass(newIndex > prevIndex ? "tab-anim-forward" : "tab-anim-back");
      const t = setTimeout(() => setAnimClass(""), 240);
      prevIndexRef.current = newIndex;
      return () => clearTimeout(t);
    }

    prevIndexRef.current = newIndex;
  }, [pathname]);

  function handleTouchStart(e) {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, target: e.target };
  }

  function handleTouchEnd(e) {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;

    // не мешаем внутренним горизонтальным скроллам (например пилюли категорий в магазине)
    if (start.target?.closest?.("[data-no-swipe]")) return;

    // не спорим с системным жестом "назад по краю экрана"
    if (start.x < EDGE_EXCLUSION || start.x > window.innerWidth - EDGE_EXCLUSION) {
      return;
    }

    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return;
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_DIRECTION_RATIO) return;

    const index = TAB_ORDER.indexOf(pathname);
    if (index === -1) return;

    if (dx < 0 && index < TAB_ORDER.length - 1) {
      router.push(TAB_ORDER[index + 1]);
    } else if (dx > 0 && index > 0) {
      router.push(TAB_ORDER[index - 1]);
    }
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className={animClass}>{children}</div>
    </div>
  );
}
