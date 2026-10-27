"use client";

import { spinsNom, chipsNom } from "@/lib/plural";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { spinWheel, buySpinsWithChips } from "@/app/mop/wheel/actions";
import { segmentColor, segmentTextColor } from "@/lib/wheel";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";
import { PLACE_SPINS } from "@/lib/tournamentRounds";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import { haptic } from "@/lib/haptics";
import Link from "next/link";
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
  if (seg.prize_type === "coins" && seg.prize_amount < 0) return { big: `-${Math.abs(seg.prize_amount)}`, small: "потеря" };
  if (seg.prize_type === "coins") return { big: Number(seg.prize_amount).toLocaleString("ru-RU"), small: isTop ? "джекпот" : "коинов" };
  if (seg.prize_type === "spins") return { big: `+${seg.prize_amount}`, small: spinsNom(seg.prize_amount) };
  if (seg.prize_type === "chips") return { big: String(seg.prize_amount), small: chipsNom(seg.prize_amount) };
  if (seg.prize_type === "custom") return { big: "приз", small: seg.label.slice(0, 12) };
  return { big: "пусто", small: "" };
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

function ResultModal({ result, spins, chips, chipPrice, jackpotAmount, onClose, onAgain, onBuyAndSpin }) {
  const loss = result.prizeType === "coins" && (result.nominalAmount ?? result.prizeAmount) < 0;
  const coins = result.prizeType === "coins" && !loss;
  const extra = result.prizeType === "spins";
  const chipWin = result.prizeType === "chips";
  const jackpot = coins && jackpotAmount > 0 && result.prizeAmount >= jackpotAmount;
  const big = coins && result.prizeAmount >= 100;
  const empty = result.prizeType === "nothing";
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
        {(big || jackpot || extra || (chipWin && result.prizeAmount >= 25)) && <Confetti />}
        <span
          className={`mx-auto flex items-center justify-center w-16 h-16 rounded-full border ${
            loss || empty ? "bg-dark-700 border-dark-600 text-gray-400" : "bg-acid-400/15 border-acid-400/40 text-acid-400"
          }`}
        >
          <Icon name={loss ? "coin" : empty ? "wheel" : jackpot ? "trophy" : extra ? "wheel" : chipWin ? "coin" : "sparkle"} className="w-8 h-8" />
        </span>
        <p className="mt-4 text-sm text-gray-400">
          {loss ? "Не повезло" : empty ? "Пусто" : jackpot ? "Джекпот!" : extra ? "Бонус" : "Твой выигрыш"}
        </p>
        {loss && (
          <>
            <p className="mt-1 font-display font-bold text-5xl text-amber-400 tabular-nums leading-none">
              {result.prizeAmount < 0 ? `-${Math.abs(result.prizeAmount).toLocaleString("ru-RU")}` : "0"}
            </p>
            <p className="mt-2 text-sm text-gray-400">
              {result.prizeAmount < 0 ? "коинов ушло с баланса" : "На балансе пусто, терять нечего"}
            </p>
          </>
        )}
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
        {chipWin && (
          <>
            <p className="mt-1 font-display font-bold text-5xl text-acid-400 tabular-nums leading-none">
              +{result.prizeAmount}
            </p>
            <p className="mt-2 text-sm text-gray-400">
              {chipsNom(result.prizeAmount)} · теперь у тебя {chips}, крутка стоит {chipPrice}
            </p>
          </>
        )}
        {result.prizeType === "custom" && (
          <>
            <p className="mt-1 font-display font-bold text-2xl text-acid-400 leading-tight">{result.label}</p>
            <p className="mt-2 text-sm text-gray-400">Админ свяжется по призу</p>
          </>
        )}
        {empty && <p className="mt-1 font-display font-bold text-2xl">В этот раз пусто, крути ещё</p>}
        <div className="mt-6 space-y-2">
          {spins === 0 && chips >= chipPrice && (
            <button
              type="button"
              onClick={onBuyAndSpin}
              className="w-full rounded-2xl bg-acid-400 text-black font-bold py-3 active:scale-[.98] transition"
            >
              Купить крутку за {chipPrice} и крутить
            </button>
          )}
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
              spins > 0 || chips >= chipPrice ? "border border-dark-600 text-gray-300" : "bg-acid-400 text-black font-bold"
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

export default function WheelClient({
  segments,
  spins: initialSpins,
  balance: initialBalance,
  chips: initialChips = 0,
  chipPrice = 10,
  bigWins = [],
}) {
  const [spins, setSpins] = useState(initialSpins ?? 0);
  const [chips, setChips] = useState(initialChips ?? 0);
  const [buying, setBuying] = useState(false);
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

  // Купить крутки за фишки. then — что сделать после (например, сразу крутить).
  async function buy(count, then) {
    if (buying || spinning) return;
    setError(null);
    setBuying(true);
    try {
      const res = await buySpinsWithChips(count);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setChips(res.chips);
      setSpins(res.spins);
      haptic.success();
      then?.(res.spins);
    } catch {
      setError("Не получилось купить, попробуй ещё раз");
    } finally {
      setBuying(false);
    }
  }

  async function handleSpin(force = false) {
    if (spinning || (!force && spins <= 0) || n === 0) return;
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
      if (typeof res.chips === "number") setChips(res.chips);
      setResult(res);
      if (res.prizeType === "nothing") haptic.light();
      else if (res.prizeType === "coins" && (res.nominalAmount ?? res.prizeAmount) < 0) haptic.warning();
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
      .map((m) => ({ label: m.label, value: `+${m.spins}` })),
    { label: "Турнир", value: `до +${Math.max(...PLACE_SPINS)}` },
  ];

  // Сначала коины по убыванию, потом фишки по убыванию.
  const worth = (x) =>
    x.prize_type === "coins" ? (x.prize_amount < 0 ? -100000 + x.prize_amount : 100000 + x.prize_amount) : x.prize_type === "chips" ? x.prize_amount : 0;
  // Одинаковые сектора (на колесе их бывает два) в списке — одной карточкой.
  const prizes = Object.values(
    segments.reduce((acc, s) => {
      const k = `${s.prize_type}:${s.prize_amount}:${s.prize_type === "custom" ? s.label : ""}`;
      acc[k] = acc[k] ? { ...acc[k], weight: (acc[k].weight || 0) + (s.weight || 0) } : { ...s };
      return acc;
    }, {})
  ).sort((a, b) => worth(b) - worth(a));

  const canBuy = Math.min(50, Math.floor(chips / Math.max(chipPrice, 1)));
  const buyOptions = [...new Set([1, 3, 5, canBuy].filter((q) => q >= 1 && q <= canBuy))].sort((a, b) => a - b);

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-acid-400/30 bg-gradient-to-br from-acid-400/15 to-dark-800 px-3 py-3">
          <p className="text-[11px] text-gray-400">Круток</p>
          <p className="font-display text-2xl font-bold text-acid-400 tabular-nums leading-tight">{spins}</p>
        </div>
        <div className="rounded-2xl border border-dark-600 bg-dark-800 px-3 py-3">
          <p className="text-[11px] text-gray-400">Фишек</p>
          <p className="font-display text-2xl font-bold tabular-nums leading-tight">{chips}</p>
        </div>
        <div className="rounded-2xl border border-dark-600 bg-dark-800 px-3 py-3 text-right">
          <p className="text-[11px] text-gray-400">Коинов</p>
          <p className="font-display text-lg font-semibold tabular-nums leading-tight mt-1">
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
            onClick={() => (spins > 0 ? handleSpin() : buy(1, () => handleSpin(true)))}
            disabled={spinning || buying || (spins <= 0 && canBuy < 1)}
            aria-label="Крутить колесо"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-[26%] aspect-square rounded-full bg-acid-400 text-black font-display font-bold text-sm shadow-[0_0_0_6px_rgb(var(--c-bg)),0_0_30px_rgb(var(--c-accent)/0.45)] active:scale-95 transition disabled:opacity-90"
          >
            {spinning || buying ? "···" : spins > 0 ? "Крутить" : canBuy > 0 ? "Купить" : "0"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}

      {n > 0 &&
        (spins > 0 ? (
          <button
            type="button"
            onClick={() => handleSpin()}
            disabled={spinning}
            className="w-full bg-acid-400 text-black font-bold rounded-2xl py-3.5 text-base active:scale-[.98] transition disabled:opacity-50"
          >
            {spinning ? "Крутится…" : `Крутить · осталось ${spins}`}
          </button>
        ) : canBuy < 1 ? (
          <div className="rounded-2xl border border-dark-600 bg-dark-800 p-4 text-center">
            <p className="font-semibold">Круток пока нет</p>
            <p className="text-sm text-gray-500 mt-1">
              Крутки дают за работу, а ещё их можно купить за фишки: {chipPrice} {chipsNom(chipPrice)} за крутку.
            </p>
          </div>
        ) : null)}

      {/* Крутки за фишки: выиграл фишки, купил крутки, крутишь дальше */}
      {n > 0 && (
        <div className="rounded-2xl border border-dark-600 bg-dark-800 p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold">Крутки за фишки</p>
            <p className="text-xs text-gray-500 shrink-0">
              1 крутка = {chipPrice} {chipsNom(chipPrice)}
            </p>
          </div>
          {buyOptions.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {buyOptions.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={buying || spinning}
                  onClick={() => buy(q)}
                  className={`rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 ${
                    q === buyOptions[0] ? "bg-acid-400 text-black" : "border border-acid-400/40 text-acid-400"
                  }`}
                >
                  ×{q}
                  <span className="block text-[10px] font-semibold opacity-70">{q * chipPrice}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Нужно ещё {chipPrice - (chips % chipPrice)} {chipsNom(chipPrice - (chips % chipPrice))}. Фишки выпадают на колесе.
            </p>
          )}
          <p className="text-[11px] text-gray-600">
            Фишки нельзя купить за коины и обменять на коины, они только для круток.
          </p>
        </div>
      )}

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
                  <p
                    className={`font-display font-bold tabular-nums ${
                      isTop ? "text-acid-400" : seg.prize_type === "coins" && seg.prize_amount < 0 ? "text-amber-400" : ""
                    }`}
                  >
                    {seg.prize_type === "coins" && seg.prize_amount < 0
                      ? `-${Math.abs(seg.prize_amount).toLocaleString("ru-RU")}`
                      : seg.prize_type === "coins" || seg.prize_type === "chips"
                        ? `+${Number(seg.prize_amount).toLocaleString("ru-RU")}`
                        : seg.prize_type === "spins"
                          ? `+${seg.prize_amount} ${spinsNom(seg.prize_amount)}`
                          : seg.prize_type === "nothing"
                            ? "Пусто"
                            : seg.label}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {isTop
                      ? "джекпот · "
                      : seg.prize_type === "coins" && seg.prize_amount < 0
                        ? "потеря коинов · "
                        : seg.prize_type === "coins"
                          ? "коинов · "
                        : seg.prize_type === "chips"
                          ? `${chipsNom(seg.prize_amount)} · `
                          : ""}
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
              <span className="shrink-0 font-display font-bold text-acid-400 tabular-nums">{w.value}</span>
            </div>
          ))}
        </div>
        <Link
          href="/mop#bonus"
          className="flex items-center justify-center gap-2 w-full rounded-2xl border border-acid-400/40 text-acid-400 font-bold py-3 active:scale-[.98] transition"
        >
          <Icon name="plus" className="w-4 h-4" />
          Запросить бонус
        </Link>
        <p className="text-xs text-gray-600 px-1">Откроется форма заявки на главном экране.</p>
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
          chips={chips}
          chipPrice={chipPrice}
          jackpotAmount={topCoins}
          onClose={() => setResult(null)}
          onAgain={() => {
            setResult(null);
            handleSpin(true);
          }}
          onBuyAndSpin={() => {
            setResult(null);
            buy(1, () => handleSpin(true));
          }}
        />
      )}
    </div>
  );
}
