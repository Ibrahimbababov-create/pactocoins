import { plural } from "@/lib/plural";

// Общие кусочки для экранов РОПа: мини-графики на чистом SVG и подписи.
// Ничего интерактивного, поэтому работают и на сервере, и в клиенте.

export const kzt = (n) => `${(Number(n) || 0).toLocaleString("ru-RU")} ₸`;

// Короткая сумма для тесных мест: 1,95 млн ₸, 411 тыс ₸.
export function kztShort(n) {
  const v = Math.round(Number(n) || 0);
  if (v >= 1000000) {
    const m = Math.round(v / 10000) / 100;
    return `${m.toLocaleString("ru-RU")} млн ₸`;
  }
  if (v >= 1000) return `${Math.round(v / 1000).toLocaleString("ru-RU")} тыс ₸`;
  return `${v} ₸`;
}

// Столбики по дням. Последний (сегодня) подсвечен, пустые дни остаются
// тонкой чертой, чтобы было видно, где оплат не было.
export function DayBars({ days, values, height = 56 }) {
  const max = Math.max(...values, 1);
  const n = values.length;
  const gap = 4;
  const w = 100;
  const bw = (w - gap * (n - 1)) / n;
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label="Выручка команды по дням"
    >
      {values.map((v, i) => {
        const h = v > 0 ? Math.max(4, (v / max) * (height - 2)) : 1.5;
        const last = i === n - 1;
        return (
          <rect
            key={days[i].key}
            x={i * (bw + gap)}
            y={height - h}
            width={bw}
            height={h}
            rx={1.2}
            className={v > 0 ? (last ? "fill-acid-400" : "fill-acid-400/50") : "fill-dark-600"}
          />
        );
      })}
    </svg>
  );
}

// Линия-«пульс» человека за две недели: видно, был ли он в деле.
export function Sparkline({ values, className = "" }) {
  const n = values.length;
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  const w = 100;
  const h = 24;
  const step = w / (n - 1);
  const pts = values.map((v, i) => [i * step, h - 2 - (v / max) * (h - 5)]);
  if (total === 0) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true">
        <line x1="0" y1={h - 2} x2={w} y2={h - 2} className="stroke-dark-600" strokeWidth="1.5" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const [lx, ly] = pts[n - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d={area} className="fill-acid-400/10" />
      <path d={line} className="stroke-acid-400" fill="none" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {values[n - 1] > 0 && <circle cx={lx} cy={ly} r="1.6" className="fill-acid-400" />}
    </svg>
  );
}

// «+18% к прошлому месяцу за те же дни». Если сравнивать не с чем, молчим.
export function DeltaChip({ now, before, label = "к прошлому месяцу" }) {
  if (!before || before <= 0) {
    return null;
  }
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 ${
        up ? "bg-acid-400/15 text-acid-400" : "bg-amber-500/15 text-amber-400"
      }`}
    >
      <svg viewBox="0 0 10 10" className={`w-2.5 h-2.5 ${up ? "" : "rotate-180"}`} fill="currentColor" aria-hidden="true">
        <path d="M5 1.5 9 8H1z" />
      </svg>
      {up ? "+" : "−"}
      {Math.abs(pct)}% {label}
    </span>
  );
}

// Статус человека на сегодня одним словом.
export function statusOf(m, quietDays) {
  if (m.role === "trainee") return { key: "trainee", label: "Стажёр", tone: "sky" };
  if (m.today_kzt > 0) return { key: "today", label: "Платил сегодня", tone: "acid" };
  if (m.days_since_paid === 1) return { key: "recent", label: "Платил вчера", tone: "muted" };
  if (m.days_since_paid != null && m.days_since_paid < quietDays) {
    return { key: "recent", label: `Был ${m.days_since_paid} ${plural(m.days_since_paid, "день", "дня", "дней")} назад`, tone: "muted" };
  }
  return {
    key: "quiet",
    label:
      m.days_since_paid == null
        ? "Давно без оплат"
        : `Молчит ${m.days_since_paid} ${plural(m.days_since_paid, "день", "дня", "дней")}`,
    tone: "warn",
  };
}
