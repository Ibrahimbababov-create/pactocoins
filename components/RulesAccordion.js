"use client";

import { formatCoins } from "@/lib/plural";

import { useState } from "react";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";
import { WEEKLY_TOP, MONTHLY_TOP } from "@/lib/topBonusConfig";
import Icon from "@/components/Icon";

export default function RulesAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm text-gray-300"
      >
        <span className="flex items-center gap-1.5">
          <Icon name="help" className="w-4 h-4 text-gray-500" />
          Что считается в рейтинге?
        </span>
        <Icon
          name="chevronRight"
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 text-sm">
          <div className="space-y-2">
            <p className="font-bold text-acid-400 flex items-center gap-1.5">
              <Icon name="check" className="w-4 h-4" strokeWidth={2.5} />
              Рейтинг считается только по выручке
            </p>
            <p className="text-gray-400 text-xs">
              Место в рейтинге зависит от суммы подтверждённых оплат в тенге.
              Бонусы, колесо и подарки на него не влияют.
            </p>
            <p className="text-gray-400 text-xs">
              Лучшие трое получают призы в коинах, если набрали от{" "}
              {WEEKLY_TOP.minLabel} за неделю ({WEEKLY_TOP.prizes
                .map((p) => p.toLocaleString("ru-RU"))
                .join(" / ")}{" "}
              коинов) или от {MONTHLY_TOP.minLabel} за месяц ({MONTHLY_TOP.prizes
                .map((p) => p.toLocaleString("ru-RU"))
                .join(" / ")}{" "}
              коинов).
            </p>
          </div>

          <div className="space-y-2 pt-3 border-t border-dark-600">
            <p className="font-bold text-gray-300">За что дают коины</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-gray-300">
                <span>Подтверждённая оплата</span>
                <span className="text-gray-500 text-xs shrink-0">1 коин за 1000 ₸</span>
              </div>
              {Object.values(BONUS_CATEGORIES).map((meta) => (
                <div
                  key={meta.label}
                  className="flex items-center justify-between gap-3 text-gray-300"
                >
                  <span>{meta.label}</span>
                  <span className="text-gray-500 text-xs shrink-0">
                    {meta.spin
                      ? "крутка колеса"
                      : meta.amount === null
                      ? "по ситуации"
                      : `${formatCoins(meta.amount)}`}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600">
              Коины приходят, когда админ подтвердит заявку. Бонусы идут на
              баланс, но на рейтинг не влияют.
            </p>
          </div>

          <p className="text-xs text-gray-600 pt-3 border-t border-dark-600">
            Покупки в магазине просто списывают коины с баланса, на рейтинг
            они тоже не влияют.
          </p>
        </div>
      )}
    </div>
  );
}
