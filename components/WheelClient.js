"use client";

import { formatCoins, spinsNom } from "@/lib/plural";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { spinWheel } from "@/app/mop/wheel/actions";
import { segmentColor, segmentTextColor } from "@/lib/wheel";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";
import { PLACE_SPINS } from "@/lib/tournamentRounds";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import { haptic } from "@/lib/haptics";
import Icon from "@/components/Icon";

// Колесо фортуны. Результат решает сервер (spinWheel), колесо только
// красиво доезжает до выпавшего сектора: сначала разгоняется, пока ждём
// ответ, потом плавно тормозит. На каждом секторе стрелка щёлкает, телефон
// в Telegram отзывается лёгкой вибрацией.

const SIZE = 320;
const C = SIZE / 2;
const R = 136; // сектора
const RIM = 156; // обод с лампочками
const BULBS = 24;
const V_MAX = 0.6; // градусов в мс на разгоне

function polar(angleDeg, radius) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [C + radius * Math.cos(a), C + radius * Math.sin(a)];
}

function slicePath(startDeg, endDeg) {
  const [x0, y0] = polar(startDeg, R);
  const [x1, y1] = polar(endDeg, R);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
}

// Насколько часто выпадает: для подписи в списке призов.
function rarity(weight, total) {
  const p = total > 0 ? weight / total : 0;
  if (p < 0.02) return "очень редко";
  if (p < 0.06) return "редко";
  if (p < 0.15) return "иногда";
  return "часто";
}

// Что написать на секторе: крупно число, мелко пояснение.
function segmentFace(seg, isTop) {
  if (seg.prize_type === "coins") return { big: Number(seg.prize_amount).toLocaleString("ru-RU"), small: isTop ? "джекпот" : "коинов" };
  if (seg.prize_type === "spins") return { big: `+${seg.prize_amount}`, small: spinsNom(seg.prize_amount) };
  if (seg.prize_type === "custom") return { big: "приз", small: seg.label.slice(0, 12) };
  return { big: "мимо", small: "" };
}

function Confetti() {
  const bits = Array.from({ length: 28 }, (_, i) => {
    const ang = (i / 28) * Math.PI * 2 + (i % 3) * 0.2;
    const dist = 90 + (i % 5) * 22;
    return {
      dx: `${Math.round(Math.cos(ang) * dist)}px`,
      dy: `${Math.round(Math.sin(ang) * dist + 40)}px`,
      rot: `${(i * 47) % 360}deg`,
      delay: `${(i % 7) * 30}ms`,
      accent: i % 3 !== 0,
    };
  });
  return (
    <div className="pointer-events-none absolute left-1/2 top-16 h-0 w-0">
      {bits.map((b, i) => (
        <span
          key={i}
          className={`wheel-confetti absolute block w-2 h-3 rounded-[2px] ${b.accent ? "bg-acid-400" : "bg-gray-200"}`}
          style={{ "--dx": b.dx, "--dy": b.dy, "--rot": b.rot, animationDelay: b.delay }}
        />
      ))}
    </div>
  );
}

function ResultModal({ result, spins, jackpotAmount, onClose, onAgain }) {
  const coins = result.prizeType === "coins";
  const extra = result.prizeType === "spins";
  const jackpot = coins && jackpotAmount > 0 && result.prizeAmount >= jackpotAmount;
  const big = coins && result.prizeAmount >= 100;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`wheel-pop relative w-full max-w-xs rounded-3xl border-2 bg-dark-800 px-6 pt-7 pb-6 text-center ${
          jackpot ? "border-acid-400 live-glow" : "border-acid-400/60"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {(big || jackpot || extra) && <Confetti />}
        <span className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-acid-400/15 border border-acid-400/40 text-acid-400">
          <Icon name={jackpot ? "trophy" : extra ? "wheel" : "sparkle"} className="w-8 h-8" />
        </span>
        <p className="mt-4 text-sm text-gray-400">{jackpot ? "Джекпот!" : extra ? "Бонус" : "Твой выигрыш"}</p>
        {coins && (
          <>
            <p className="mt-1 font-display font-bold text-5xl text-acid-400 tabular-nums leading-none">
              +{Number(result.prizeAmount).toLocaleString("ru-RU")}
            </p>
            <p className="mt-2 text-sm text-gray-400">коинов уже на балансе</p>
          </>
        )}
        {extra && (
          <>
            <p className="mt-1 font-display font-bold text-3xl text-acid-400 leading-tight">
              +{result.prizeAmount} {spinsNom(result.prizeAmount)}
            </p>
            <p className="mt-2 text-sm text-gray-400">Крути ещё раз</p>
          </>
        )}
        {result.prizeType === "custom" && (
          <>
            <p className="mt-1 font-display font-bold text-2xl text-acid-400 leading-tight">{result.label}</p>
            <p className="mt-2 text-sm text-gray-400">Админ свяжется по призу</p>
          </>
        )}
        {result.prizeType === "nothing" && <p className="mt-1 font-display font-bold text-2xl">В этот раз мимо</p>}
        <div className="mt-6 space-y-2">
          {spins > 0 && (
            <button
              type="button"
              onClick={onAgain}
              className="w-full rounded-2xl bg-acid-400 text-black font-bold py-3 active:scale-[.98] transition"
            >
              Крутить ещё · {spins}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`w-full rounded-2xl py-3 font-semibold ${
              spins > 0 ? "border border-dark-600 text-gray-300" : "bg-acid-400 text-black font-bold"
            }`}
          >
            Готово
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function WheelClient({ segments, spins: initialSpins, balance: initialBalance, bigWins = [] }) {
  const [spins, setSpins] = useState(initialSpins ?? 0);
  const [balance, setBalance] = useState(initialBalance ?? 0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const wheelRef = useRef(null);
  const pointerRef = useRef(null);
  const angleRef = useRef(0);
  const runRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      runRef.current = null;
    };
  }, []);

  const n = segments.length;
  const slice = n > 0 ? 360 / n : 360;
  const totalWeight = segments.reduce((s, x) => s + Math.max(0, x.weight || 0), 0);
  const topCoins = Math.max(0, ...segments.filter((s) => s.prize_type === "coins").map((s) => s.prize_amount || 0));

  // Какой сектор сейчас под стрелкой (стрелка сверху, колесо крутится по часовой).
  const indexAt = (a) => {
    const onWheel = (((360 - (a % 360)) % 360) + 360) % 360;
    return Math.floor(onWheel / slice) % Math.max(n, 1);
  };

  const kick = () => {
    pointerRef.current?.animate?.(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(-18deg)" }, { transform: "rotate(0deg)" }],
      { duration: 140, easing: "ease-out" }
    );
  };

  // Один цикл анимации: разгон → (пришёл ответ) → торможение до сектора.
  function runSpin(onDone) {
    const now0 = performance.now();
    runRef.current = { phase: "accel", start: now0, last: now0, v: 0, landing: null, onDone };
    let lastIdx = indexAt(angleRef.current);
    let lastTick = 0;
    const step = (now) => {
      const s = runRef.current;
      if (!s) return;
      const dt = Math.min(48, now - s.last);
      s.last = now;
      if (s.phase === "accel") {
        s.v = V_MAX * Math.min(1, (now - s.start) / 500);
        angleRef.current += s.v * dt;
        if (s.landing !== null && now - s.start >= 500) {
          const from = angleRef.current;
          let target = from - (from % 360) + s.landing;
          while (target - from < 360 * 2.5) target += 360;
          s.phase = "brake";
          s.from = from;
          s.delta = target - from;
          s.t0 = now;
          // Скорость в начале торможения совпадает со скоростью разгона.
          s.ms = Math.max(3200, Math.min(6500, (3 * s.delta) / s.v));
        }
      } else if (s.phase === "brake") {
        const t = Math.min(1, (now - s.t0) / s.ms);
        angleRef.current = s.from + s.delta * (1 - Math.pow(1 - t, 3));
        if (t >= 1) s.phase = "done";
      }
      if (wheelRef.current) wheelRef.current.style.transform = `rotate(${angleRef.current}deg)`;
      const idx = indexAt(angleRef.current);
      if (idx !== lastIdx) {
        lastIdx = idx;
        if (now - lastTick > 55) {
          lastTick = now;
          kick();
          haptic.light();
        }
      }
      if (s.phase === "done") {
        runRef.current = null;
        s.onDone?.();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  async function handleSpin() {
    if (spinning || spins <= 0 || n === 0) return;
    setError(null);
    setResult(null);
    setSpinning(true);
    haptic.medium();

    let res = null;
    runSpin(() => {
      setSpinning(false);
      if (!res || res.error) return;
      setSpins(res.spins);
      setBalance(res.balance);
      setResult(res);
      if (res.prizeType === "nothing") haptic.light();
      else haptic.success();
    });

    try {
      res = await spinWheel();
    } catch {
      res = { error: "Не получилось прокрутить, попробуй ещё раз" };
    }
    const s = runRef.current;
    if (res?.error) {
      setError(res.error);
      // Ошибка: колесо мягко останавливается там, где было.
      if (s) s.landing = (360 - (angleRef.current % 360) + 360 - 40) % 360;
      return;
    }
    const center = res.index * slice + slice / 2;
    const jitter = (Math.random() - 0.5) * slice * 0.6;
    if (s) s.landing = (((360 - center - jitter) % 360) + 360) % 360;
  }

  const ways = [
    ...Object.values(BONUS_CATEGORIES)
      .filter((m) => m.spins && !m.hidden)
      .map((m) => ({ label: m.label, spins: m.spins })),
    { label: "Турнир: 1-е, 2-е, 3–4-е место", spins: PLACE_SPINS.join(" / ") },
  ];

  const prizes = [...segments].sort((a, b) => {
    const va = a.prize_type === "coins" ? a.prize_amount : a.prize_type === "spins" ? 50 : 0;
    const vb = b.prize_type === "coins" ? b.prize_amount : b.prize_type === "spins" ? 50 : 0;
    return vb - va;
  });

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-stretch gap-3">
        <div className="flex-1 rounded-2xl border border-acid-400/30 bg-gradient-to-br from-acid-400/15 to-dark-800 px-4 py-3">
          <p className="text-xs text-gray-400">Круток</p>
          <p className="font-display text-3xl font-bold text-acid-400 tabular-nums leading-tight">{spins}</p>
        </div>
        <div className="flex-1 rounded-2xl border border-dark-600 bg-dark-800 px-4 py-3 text-right">
          <p className="text-xs text-gray-400">Баланс</p>
          <p className="font-display text-xl font-semibold tabular-nums leading-tight mt-1">
            {balance.toLocaleString("ru-RU")}
          </p>
        </div>
      </div>

      {n === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">Колесо ещё не настроено.</p>
      ) : (
        <div className={`relative mx-auto w-full max-w-[340px] aspect-square ${spinning ? "wheel-fast" : ""}`}>
          <div className="absolute inset-[6%] rounded-full bg-acid-400/10 blur-2xl" />

          {/* Обод с лампочками: стоит на месте */}
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 w-full h-full">
            <defs>
              <radialGradient id="wheel-rim" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="rgb(var(--c-border))" />
                <stop offset="100%" stopColor="rgb(var(--c-line))" />
              </radialGradient>
            </defs>
            <circle cx={C} cy={C} r={RIM} fill="url(#wheel-rim)" stroke="rgb(var(--c-accent) / 0.45)" strokeWidth="2" />
            <circle cx={C} cy={C} r={R + 3} fill="rgb(var(--c-bg))" />
            {Array.from({ length: BULBS }, (_, i) => {
              const [x, y] = polar((360 / BULBS) * i, (RIM + R + 3) / 2);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="3.6"
                  fill="rgb(var(--c-accent))"
                  className="wheel-bulb"
                  style={{ animationDelay: i % 2 ? "0s" : "-0.8s" }}
                />
              );
            })}
          </svg>

          {/* Само колесо: крутим этот слой */}
          <div ref={wheelRef} className="absolute inset-0 will-change-transform">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full">
              <defs>
                <radialGradient id="wheel-shine" cx="50%" cy="50%" r="50%">
                  <stop offset="55%" stopColor="#fff" stopOpacity="0" />
                  <stop offset="100%" stopColor="#fff" stopOpacity="0.08" />
                </radialGradient>
              </defs>
              {segments.map((seg, i) => {
                const start = i * slice;
                const mid = start + slice / 2;
                const fill = segmentColor(seg, i);
                const ink = segmentTextColor(fill);
                const isTop = seg.prize_type === "coins" && seg.prize_amount === topCoins && topCoins > 0;
                const face = segmentFace(seg, isTop);
                const [bx, by] = polar(mid, R * 0.7);
                const [sx, sy] = polar(mid, R * 0.5);
                return (
                  <g key={seg.id}>
                    <path d={slicePath(start, start + slice)} fill={fill} />
                    <line
                      x1={C}
                      y1={C}
                      x2={polar(start, R)[0]}
                      y2={polar(start, R)[1]}
                      stroke="rgb(var(--c-bg) / 0.55)"
                      strokeWidth="1.5"
                    />
                    <text
                      x={bx}
                      y={by}
                      fill={ink}
                      fontSize={face.big.length > 4 ? 15 : 19}
                      fontWeight="800"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{ fontFamily: "var(--font-unbounded)" }}
                      transform={`rotate(${mid}, ${bx}, ${by})`}
                    >
                      {face.big}
                    </text>
                    {face.small && (
                      <text
                        x={sx}
                        y={sy}
                        fill={ink}
                        fillOpacity="0.75"
                        fontSize="8.5"
                        fontWeight="600"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${mid}, ${sx}, ${sy})`}
                      >
                        {face.small}
                      </text>
                    )}
                  </g>
                );
              })}
              <circle cx={C} cy={C} r={R} fill="url(#wheel-shine)" />
              <circle cx={C} cy={C} r={R} fill="none" stroke="rgb(var(--c-accent) / 0.35)" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Стрелка */}
          <div className="absolute left-1/2 top-[1%] -translate-x-1/2 z-10">
            <div ref={pointerRef} style={{ transformOrigin: "50% 20%" }}>
              <svg width="34" height="42" viewBox="0 0 34 42" className="drop-shadow-[0_3px_6px_rgba(0,0,0,0.5)]">
                <path d="M17 41 L3 10 A15 15 0 1 1 31 10 Z" fill="rgb(var(--c-accent))" />
                <circle cx="17" cy="14" r="5" fill="rgb(var(--c-bg))" />
              </svg>
            </div>
          </div>

          {/* Кнопка в центре */}
          <button
            type="button"
            onClick={handleSpin}
            disabled={spinning || spins <= 0}
            aria-label="Крутить колесо"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-[26%] aspect-square rounded-full bg-acid-400 text-black font-display font-bold text-sm shadow-[0_0_0_6px_rgb(var(--c-bg)),0_0_30px_rgb(var(--c-accent)/0.45)] active:scale-95 transition disabled:opacity-90"
          >
            {spinning ? "···" : spins > 0 ? "Крутить" : "0"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}

      {n > 0 &&
        (spins > 0 ? (
          <button
            type="button"
            onClick={handleSpin}
            disabled={spinning}
            className="w-full bg-acid-400 text-black font-bold rounded-2xl py-3.5 text-base active:scale-[.98] transition disabled:opacity-50"
          >
            {spinning ? "Крутится…" : `Крутить · осталось ${spins}`}
          </button>
        ) : (
          <div className="rounded-2xl border border-dark-600 bg-dark-800 p-4 text-center">
            <p className="font-semibold">Круток пока нет</p>
            <p className="text-sm text-gray-500 mt-1">Крутки дают за работу, смотри ниже, за что.</p>
          </div>
        ))}

      {n > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 px-1">Что можно выиграть</p>
          <div className="grid grid-cols-2 gap-2">
            {prizes.map((seg) => {
              const isTop = seg.prize_type === "coins" && seg.prize_amount === topCoins && topCoins > 0;
              return (
                <div
                  key={seg.id}
                  className={`rounded-xl border px-3 py-2.5 ${
                    isTop ? "border-acid-400/50 bg-acid-400/10" : "border-dark-600 bg-dark-800"
                  }`}
                >
                  <p className={`font-display font-bold tabular-nums ${isTop ? "text-acid-400" : ""}`}>
                    {seg.prize_type === "coins"
                      ? `+${Number(seg.prize_amount).toLocaleString("ru-RU")}`
                      : seg.prize_type === "spins"
                        ? `+${seg.prize_amount} ${spinsNom(seg.prize_amount)}`
                        : seg.label}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {isTop ? "джекпот · " : seg.prize_type === "coins" ? "коинов · " : ""}
                    {rarity(seg.weight || 0, totalWeight)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-gray-500 px-1">Как получить крутки</p>
        <div className="rounded-2xl border border-dark-600 bg-dark-800 divide-y divide-dark-700">
          {ways.map((w) => (
            <div key={w.label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="text-gray-300">{w.label}</span>
              <span className="shrink-0 font-display font-bold text-acid-400 tabular-nums">+{w.spins}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 px-1">Бонусы подаются как обычно, заявкой на главном экране.</p>
      </div>

      {bigWins.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 px-1">Крупные выигрыши за неделю</p>
          <div className="rounded-2xl border border-dark-600 bg-dark-800 divide-y divide-dark-700">
            {bigWins.map((w) => (
              <div key={w.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Icon name="sparkle" className="w-4 h-4 shrink-0 text-acid-400" />
                <span className="min-w-0 flex-1 truncate font-semibold">{w.name}</span>
                <span className="shrink-0 text-[11px] text-gray-500 tabular-nums">
                  {formatDateTimeAlmaty(w.created_at).replace(/\.\d{4},/, ",")}
                </span>
                <span className="shrink-0 w-16 text-right font-display font-bold text-acid-400 tabular-nums">
                  +{w.amount.toLocaleString("ru-RU")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {mounted && result && (
        <ResultModal
          result={result}
          spins={spins}
          jackpotAmount={topCoins}
          onClose={() => setResult(null)}
          onAgain={() => {
            setResult(null);
            handleSpin();
          }}
        />
      )}
    </div>
  );
}
