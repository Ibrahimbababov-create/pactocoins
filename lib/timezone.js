const TIMEZONE = "Asia/Almaty";

function partsInAlmaty(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month), // 1-12
    day: Number(parts.day),
    weekday: parts.weekday, // "Mon", "Tue", ...
  };
}

// "Сейчас" по Алматы, в виде {year, month, day, weekday}
export function nowInAlmaty() {
  return partsInAlmaty(new Date());
}

export function isMondayInAlmaty() {
  return nowInAlmaty().weekday === "Mon";
}

export function isFirstOfMonthInAlmaty() {
  return nowInAlmaty().day === 1;
}

// UTC-эквивалент полуночи заданного дня по Алматы (UTC+5, без перехода на летнее время)
function almatyMidnightUtc(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, -5, 0, 0, 0));
}

// Границы "сегодня" по Алматы, в виде ISO-строк UTC — [start, end)
export function todayRangeAlmaty() {
  const { year, month, day } = nowInAlmaty();
  const start = almatyMidnightUtc(year, month, day);
  const end = almatyMidnightUtc(year, month, day + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

// Границы "прошлой календарной недели" (пн-вс) относительно сегодняшнего дня по Алматы
export function lastWeekRangeAlmaty() {
  const { year, month, day } = nowInAlmaty();
  const todayUtcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dow = todayUtcNoon.getUTCDay(); // 0=вс, 1=пн, ...
  const diffToThisMonday = dow === 0 ? 6 : dow - 1;

  const thisMonday = new Date(todayUtcNoon);
  thisMonday.setUTCDate(thisMonday.getUTCDate() - diffToThisMonday);

  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);

  const start = almatyMidnightUtc(
    lastMonday.getUTCFullYear(),
    lastMonday.getUTCMonth() + 1,
    lastMonday.getUTCDate()
  );
  const end = almatyMidnightUtc(
    thisMonday.getUTCFullYear(),
    thisMonday.getUTCMonth() + 1,
    thisMonday.getUTCDate()
  );

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: formatWeekLabel(lastMonday),
  };
}

// Границы "прошлого календарного месяца" относительно сегодняшнего дня по Алматы
export function lastMonthRangeAlmaty() {
  const { year, month } = nowInAlmaty();
  // Первое число текущего месяца минус 1 месяц = первое число прошлого месяца
  const prevMonthDate = new Date(Date.UTC(year, month - 2, 1));
  const prevYear = prevMonthDate.getUTCFullYear();
  const prevMonth = prevMonthDate.getUTCMonth() + 1;

  const start = almatyMidnightUtc(prevYear, prevMonth, 1);
  const end = almatyMidnightUtc(year, month, 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: formatMonthLabel(prevYear, prevMonth),
  };
}

const MONTHS_RU = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

function formatMonthLabel(year, month) {
  return `${MONTHS_RU[month - 1]} ${year}`;
}

function formatWeekLabel(mondayUtcDate) {
  const sunday = new Date(mondayUtcDate);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  const fmt = (d) =>
    `${String(d.getUTCDate()).padStart(2, "0")}.${String(
      d.getUTCMonth() + 1
    ).padStart(2, "0")}`;

  return `${fmt(mondayUtcDate)}–${fmt(sunday)}.${sunday.getUTCFullYear()}`;
}
