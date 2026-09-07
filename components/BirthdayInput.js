"use client";

import { useState } from "react";

// Три выпадашки день / месяц / год вместо нативного <input type="date">
// — в вебвью Telegram год выбирать неудобно. Локальное состояние держим
// внутри: пока дата не заполнена целиком, наружу отдаём "".

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const THIS_YEAR = new Date().getFullYear();
const YEARS = [];
for (let yy = THIS_YEAR - 14; yy >= THIS_YEAR - 75; yy--) YEARS.push(yy);

function daysInMonth(year, month) {
  if (!month) return 31;
  return new Date(Number(year || THIS_YEAR), Number(month), 0).getDate();
}

export default function BirthdayInput({ value = "", onChange }) {
  const [iy, im, id] = (value || "").split("-");
  const [d, setD] = useState(id ? String(Number(id)) : "");
  const [m, setM] = useState(im ? String(Number(im)) : "");
  const [y, setY] = useState(iy || "");

  function push(nd, nm, ny) {
    setD(nd);
    setM(nm);
    setY(ny);
    if (nd && nm && ny) {
      const dd = Math.min(Number(nd), daysInMonth(ny, nm));
      onChange?.(
        `${ny}-${String(nm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`
      );
    } else {
      onChange?.("");
    }
  }

  const cls =
    "bg-dark-700 border border-dark-600 rounded-lg px-2 py-3 text-white focus:outline-none focus:border-acid-400";

  return (
    <div className="grid grid-cols-3 gap-2">
      <select value={d} onChange={(e) => push(e.target.value, m, y)} className={cls}>
        <option value="">День</option>
        {Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <select value={m} onChange={(e) => push(d, e.target.value, y)} className={cls}>
        <option value="">Месяц</option>
        {MONTHS.map((name, i) => (
          <option key={i} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select value={y} onChange={(e) => push(d, m, e.target.value)} className={cls}>
        <option value="">Год</option>
        {YEARS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
