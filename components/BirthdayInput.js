"use client";

// Три выпадашки день / месяц / год вместо нативного <input type="date">
// — в вебвью Telegram год выбирать неудобно. Отдаёт "YYYY-MM-DD" или "".

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const THIS_YEAR = new Date().getFullYear();
const YEARS = [];
for (let y = THIS_YEAR - 14; y >= THIS_YEAR - 75; y--) YEARS.push(y);

function daysInMonth(year, month) {
  if (!month) return 31;
  return new Date(Number(year || THIS_YEAR), Number(month), 0).getDate();
}

export default function BirthdayInput({ value = "", onChange }) {
  const [y = "", m = "", d = ""] = (value || "").split("-");
  // при value типа "2000-03-05" -> y=2000, m=03, d=05
  const day = d ? String(Number(d)) : "";
  const month = m ? String(Number(m)) : "";
  const year = y || "";

  function emit(nd, nm, ny) {
    if (!nd || !nm || !ny) return onChange?.("");
    const maxD = daysInMonth(ny, nm);
    const dd = Math.min(Number(nd), maxD);
    onChange?.(
      `${ny}-${String(nm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`
    );
  }

  const cls =
    "bg-dark-700 border border-dark-600 rounded-lg px-2 py-3 text-white focus:outline-none focus:border-acid-400";

  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        value={day}
        onChange={(e) => emit(e.target.value, month, year)}
        className={cls}
      >
        <option value="">День</option>
        {Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map(
          (n) => (
            <option key={n} value={n}>
              {n}
            </option>
          )
        )}
      </select>
      <select
        value={month}
        onChange={(e) => emit(day, e.target.value, year)}
        className={cls}
      >
        <option value="">Месяц</option>
        {MONTHS.map((name, i) => (
          <option key={i} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => emit(day, month, e.target.value)}
        className={cls}
      >
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
