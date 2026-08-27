"use client";

import { usePathname } from "next/navigation";

// Лёгкое появление контента при переходе между экранами: меняется
// путь — меняется key — заново проигрывается CSS-анимация page-enter.
export default function PageTransition({ children }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
