"use client";

import { useState } from "react";
import RevenueRequestForm from "@/components/RevenueRequestForm";
import BonusRequestForm from "@/components/BonusRequestForm";

// Кнопка «Записать выручку» крупная и рядом поменьше «Бонус» — когда
// одна открыта, вторая скрывается, чтобы её форма заняла всю ширину.
export default function RequestActions() {
  const [activeForm, setActiveForm] = useState(null); // null | "revenue" | "bonus"

  return (
    <div className={activeForm ? "" : "flex gap-3"}>
      {activeForm !== "bonus" && (
        <RevenueRequestForm
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
