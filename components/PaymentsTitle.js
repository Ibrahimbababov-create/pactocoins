"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

export default function PaymentsTitle() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center gap-1">
        <h1 className="text-2xl font-bold">Мои оплаты</h1>
        <button
          type="button"
          aria-label="Почему исправляет только админ?"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
            open ? "text-acid-400" : "text-gray-500"
          }`}
        >
          <Icon name="help" className="w-[18px] h-[18px]" />
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-lg border border-dark-600 bg-dark-700 px-4 py-3 text-sm text-gray-300">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-acid-400">Почему исправляет только админ?</p>
            <button
              type="button"
              aria-label="Закрыть подсказку"
              onClick={() => setOpen(false)}
              className="-my-2 -mr-2 flex h-8 w-8 shrink-0 items-center justify-center text-gray-500"
            >
              <Icon name="x" className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-1 leading-snug">
            Коины и рейтинг считаются по оплатам. Если бы оплату можно было менять самому, это открывало бы дорогу ошибкам и обманам. Поэтому ты предлагаешь исправление, админ проверяет и применяет, а все изменения записываются в журнал. Так всё честно для всей команды.
          </p>
        </div>
      )}
    </>
  );
}
