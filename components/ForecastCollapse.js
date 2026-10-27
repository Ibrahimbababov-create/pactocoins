"use client";

import { useEffect, useState } from "react";

const KEY = "pc_forecast_open";

// Прогноз расхода по умолчанию спрятан: главное на карточке это сама
// стоимость программы. Выбор запоминаем в браузере.
export default function ForecastCollapse({ children }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "1") setOpen(true);
    } catch {}
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {}
  };

  return (
    <div className="mt-4 pt-3 border-t border-dark-600">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left text-sm text-gray-300"
      >
        <span>Прогноз до конца месяца</span>
        <span className="text-xs text-acid-400">{open ? "Скрыть" : "Показать"}</span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
