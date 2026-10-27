"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { haptic } from "@/lib/haptics";
import Icon from "@/components/Icon";
import RevenueRequestForm from "@/components/RevenueRequestForm";
import BonusRequestForm from "@/components/BonusRequestForm";

// «Записать выручку» закреплена внизу экрана над нижним меню (портал в body,
// чтобы fixed не уезжал из-за transform у обёрток страницы), форма выезжает
// шторкой. «Бонус» остаётся обычной кнопкой в потоке страницы.
export default function RequestActions({ multiplier = 1, monthKzt = 0, canSubmitRevenue = true }) {
  const [activeForm, setActiveForm] = useState(null); // null | "revenue" | "bonus"
  const boxRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Ссылка «Запросить бонус» с экрана колеса ведёт на /mop#bonus: сразу
  // открываем форму бонуса.
  useEffect(() => {
    if (window.location.hash === "#bonus") setActiveForm("bonus");
  }, []);

  // Форма бонуса раскрывается внизу страницы, подкручиваем к её началу.
  useEffect(() => {
    if (activeForm !== "bonus") return;
    const t = setTimeout(() => {
      boxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(t);
  }, [activeForm]);

  return (
    <>
      <div ref={boxRef} className="scroll-mt-20">
        <BonusRequestForm
          open={activeForm === "bonus"}
          onOpenChange={(v) => setActiveForm(v ? "bonus" : null)}
        />
      </div>

      {canSubmitRevenue && (
        <>
          {/* Запас снизу, чтобы плавающая кнопка не закрывала последний блок */}
          <div className="h-16" aria-hidden="true" />
          <RevenueRequestForm
            multiplier={multiplier}
            monthKzt={monthKzt}
            open={activeForm === "revenue"}
            onOpenChange={(v) => setActiveForm(v ? "revenue" : null)}
          />
          {mounted &&
            activeForm !== "revenue" &&
            createPortal(
              <div className="fixed inset-x-0 z-40 pointer-events-none bottom-[calc(4.25rem+env(safe-area-inset-bottom))]">
                <div className="max-w-lg mx-auto px-4">
                  <button
                    type="button"
                    onClick={() => {
                      haptic.light();
                      setActiveForm("revenue");
                    }}
                    className="pointer-events-auto w-full flex items-center justify-center gap-2 bg-acid-400 text-black font-bold rounded-2xl py-3.5 shadow-lg shadow-black/40 active:scale-[0.98] transition"
                  >
                    <Icon name="plus" className="w-5 h-5" strokeWidth={2.5} />
                    Записать выручку
                  </button>
                </div>
              </div>,
              document.body
            )}
        </>
      )}
    </>
  );
}
