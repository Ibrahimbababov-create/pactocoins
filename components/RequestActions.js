"use client";

import { useEffect, useRef, useState } from "react";
import RevenueRequestForm from "@/components/RevenueRequestForm";
import BonusRequestForm from "@/components/BonusRequestForm";

// Кнопка «Записать выручку» крупная и рядом поменьше «Бонус» — когда
// одна открыта, вторая скрывается, чтобы её форма заняла всю ширину.
export default function RequestActions({ multiplier = 1, monthKzt = 0 }) {
  const [activeForm, setActiveForm] = useState(null); // null | "revenue" | "bonus"
  const boxRef = useRef(null);

  // Кнопки внизу экрана, и форма раскрывалась за его краем — казалось,
  // что нажатие не сработало. Подкручиваем к началу формы.
  useEffect(() => {
    if (!activeForm) return;
    const t = setTimeout(() => {
      boxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(t);
  }, [activeForm]);

  return (
    <div ref={boxRef} className={activeForm ? "scroll-mt-20" : "flex gap-3"}>
      {activeForm !== "bonus" && (
        <RevenueRequestForm
          multiplier={multiplier}
          monthKzt={monthKzt}
          open={activeForm === "revenue"}
          onOpenChange={(v) => setActiveForm(v ? "revenue" : null)}
        />
      )}
      {activeForm !== "revenue" && (
        <BonusRequestForm
          open={activeForm === "bonus"}
          onOpenChange={(v) => setActiveForm(v ? "bonus" : null)}
        />
      )}
    </div>
  );
}
