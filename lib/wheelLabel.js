// Подписи на секторах «Колеса фортуны»: размер шрифта и место.
//
// Текст на секторе лежит поперёк радиуса, число сверху (ближе к ободку),
// пояснение под ним. Сектор сужается к центру, поэтому всё считаем так:
// ширина строки должна уместиться в клин сектора на самом узком месте
// (у внутреннего края строки), а дальние углы не должны заходить на обод.
// Шрифт подбирается от крупного к мелкому, пока подпись не влезет с запасом.
// Только арифметика, без измерения в браузере: на сервере и в браузере
// получается одно и то же, гидратация не ломается.
//
// Единицы — как в SVG колеса (viewBox 320 на 320, центр в 160, радиус 136).

const R_OUT = 124; // углы подписи не дальше этого радиуса (сектор кончается на 136)
const R_IN = 52; // ближе нельзя: кнопка «Крутить» (радиус ~42) и её кольцо
const PAD = 3.5; // воздух до линий между секторами (запас на неточность оценки ширины)
const GAP = 3; // между числом и пояснением

// Предел размера числа по числу знаков: чем длиннее, тем мельче.
// Дальше подбор всё равно уменьшит, если в этом секторе не влезает.
const BIG_CAP = [22, 22, 22, 18, 14.5, 12, 10.5];
const BIG_MIN = 7;
const SMALL_CAP = 10;
const SMALL_FLOOR = 8.5; // нормальный размер пояснения; ниже опускаем только если иначе не влезает
const SMALL_MIN = 6.5;

// Ширина в «эм» с запасом (Unbounded 800 широкий: цифра ~0.86, берём 0.88).
function bigEm(text) {
  let w = 0;
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") w += 0.88;
    else if (ch === "-" || ch === "+") w += 0.74;
    else if (/\s/.test(ch)) w += 0.36; // обычный и неразрывные пробелы (разряды: «10 000»)
    else w += 0.92;
  }
  return w;
}

// Onest 600: буква в среднем ~0.56, берём 0.68 с запасом на «ж», «ш», «ы».
function smallEm(text) {
  let w = 0;
  for (const ch of text) w += ch === " " ? 0.3 : ch === "…" ? 0.9 : 0.68;
  return w;
}

// Для призов «вручную» название длинное: режем с многоточием, пока не влезет.
// Обычные пояснения («коинов», «джекпот») не режем: если места мало, уменьшаем шрифт.
function smallCandidates(text, shortenable) {
  const t = String(text || "").trim();
  if (!t) return [""];
  const out = [t];
  if (shortenable) for (let len = t.length - 1; len >= 3; len--) out.push(`${t.slice(0, len).trim()}…`);
  return out;
}

/**
 * @param {{big: string, small: string, shortenable?: boolean}} face  что написать
 *   (число и пояснение; shortenable: пояснение можно обрезать с «…»)
 * @param {number} sliceDeg  угол одного сектора в градусах
 * @returns {{bigR: number, bigSize: number, smallR: number, smallSize: number, small: string}}
 *   bigR/smallR — расстояние от центра колеса до середины строки.
 */
export function layoutWheelLabel(face, sliceDeg) {
  const r = solveLayout(face, sliceDeg);
  // Округляем, чтобы на сервере и в браузере получались одинаковые числа.
  const q = (x) => Math.round(x * 100) / 100;
  return { bigR: q(r.bigR), bigSize: q(r.bigSize), smallR: q(r.smallR), smallSize: q(r.smallSize), small: r.small };
}

function solveLayout(face, sliceDeg) {
  const tanA = Math.tan((Math.min(sliceDeg / 2, 80) * Math.PI) / 180);
  const wide = bigEm(face.big);
  const cap = BIG_CAP[Math.min(face.big.length, BIG_CAP.length - 1)];
  const smalls = smallCandidates(face.small, face.shortenable);

  // Влезает ли строка полушириной half между радиусами dIn..dOut.
  const fits = (half, dIn, dOut) => dIn >= R_IN && half + PAD <= dIn * tanA && Math.hypot(dOut, half) <= R_OUT;

  // Первый проход держит пояснение нормального размера и уменьшает число;
  // второй, только если иначе никак, даёт пояснению опуститься до минимума.
  for (const sLowest of [SMALL_FLOOR, SMALL_MIN]) {
    for (let f = cap; f >= BIG_MIN; f -= 0.5) {
      const half = (wide * f) / 2;
      const hb = f * 0.8;
      // Верх числа стоит как можно ближе к ободку, но углы остаются внутри R_OUT.
      const top = Math.sqrt(Math.max(0, R_OUT * R_OUT - half * half));
      const bigIn = top - hb;
      if (!fits(half, bigIn, top)) continue;
      const bigR = top - hb / 2;

      if (!face.small) return { bigR, bigSize: f, smallR: 0, smallSize: 0, small: "" };

      const sTop = Math.min(f, SMALL_CAP);
      const sStop = Math.min(sTop, sLowest);
      for (const text of smalls) {
        for (let s = Math.min(sTop, Math.max(sStop, f * 0.55)); s >= sStop - 0.001; s -= 0.25) {
          const sHalf = (smallEm(text) * s) / 2;
          const hs = s * 0.85;
          const sOut = bigIn - GAP;
          if (fits(sHalf, sOut - hs, sOut)) {
            return { bigR, bigSize: f, smallR: sOut - hs / 2, smallSize: s, small: text };
          }
        }
      }
    }
  }

  // Крайний случай (очень много секторов): самый мелкий размер у ободка.
  const f = BIG_MIN;
  const half = (wide * f) / 2;
  const hb = f * 0.8;
  const top = Math.sqrt(Math.max(0, R_OUT * R_OUT - half * half));
  const bigR = top - hb / 2;
  if (!face.small) return { bigR, bigSize: f, smallR: 0, smallSize: 0, small: "" };
  const text = smalls[smalls.length - 1];
  return { bigR, bigSize: f, smallR: top - hb - GAP - (SMALL_MIN * 0.85) / 2, smallSize: SMALL_MIN, small: text };
}
