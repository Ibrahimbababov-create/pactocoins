"use client";

import { useState } from "react";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";

export default function RulesAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm text-gray-300"
      >
        <span>❓ Что считается в рейтинге?</span>
        <span className="text-gray-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 text-sm">
          <div className="space-y-2">
            <p className="font-bold text-acid-400">✅ Идёт в рейтинг</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-gray-300">
                <span>Подтверждённая выручка</span>
                <span className="text-gray-500 text-xs">1000 ₸ = 1 coin</span>
              </div>
              {Object.values(BONUS_CATEGORIES).map((meta) => (
                <div
                  key={meta.label}
                  className="flex items-center justify-between text-gray-300"
                >
                  <span>{meta.label}</span>
                  <span className="text-gray-500 text-xs">
                    {meta.amount === null
                      ? "по ситуации"
                      : `${meta.amount} coins`}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between text-gray-300">
                <span>Призовые ТОП недели / месяца</span>
                <span className="text-gray-500 text-xs">
                  по решению админа
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              Засчитывается только после подтверждения администратором.
            </p>
          </div>

          <div className="space-y-2 pt-3 border-t border-dark-600">
            <p className="font-bold text-gray-400">
              🚫 Даёт монеты, но НЕ идёт в рейтинг
            </p>
            <p className="text-gray-400 text-xs">
              Разовые подарки от админа (день рождения и подобные поводы, не
              связанные с работой), а также любое начисление, которое админ
              явно отметил как "не учитывать в рейтинге".
            </p>
            <p className="text-xs text-gray-600">
              Монеты всё равно попадают на баланс и их можно тратить в
              магазине — просто они не влияют на место в рейтинге.
            </p>
          </div>

          <p className="text-xs text-gray-600 pt-3 border-t border-dark-600">
            Покупки в магазине списывают coins и никак не влияют на
            рейтинг — рейтинг считает только заработанное, а не потраченное.
          </p>
        </div>
      )}
    </div>
  );
}
