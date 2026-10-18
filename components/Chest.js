"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { openChest } from "@/app/mop/chestActions";
import { chipsNom, spinsNom } from "@/lib/plural";
import { haptic } from "@/lib/haptics";
import Icon from "@/components/Icon";

// Сундук как в Clash Royale. На главной и в «Играх» — карточка, по тапу
// сундук падает на весь экран; тап по нему: трясётся, крышка отлетает,
// изнутри бьёт свет и вылетает приз со счётчиком. Что внутри, решает
// сервер (openChest), экран только показывает.

const LID = "M40 110 L40 84 Q40 48 120 44 Q200 48 200 84 L200 110 Z";

export function ChestArt({ open = false, glow = false, className = "" }) {
  const id = useId().replace(/:/g, "");
  const u = (name) => `url(#${id}${name})`;
  return (
    <svg viewBox="0 0 240 200" className={className} overflow="visible" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8A4F24" />
          <stop offset="100%" stopColor="#4A2810" />
        </linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A9652F" />
          <stop offset="100%" stopColor="#5C3315" />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE7A0" />
          <stop offset="45%" stopColor="#E7B04A" />
          <stop offset="100%" stopColor="#9A6514" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#FFF4CF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#FFD77A" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}i`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFBEA" />
          <stop offset="55%" stopColor="#FFD77A" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFB23E" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}c`}>
          <path d={LID} />
        </clipPath>
        <filter id={`${id}f`} x="-20%" y="-300%" width="140%" height="700%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Свет из открытого сундука */}
      <polygon className={`chest-beam ${open ? "is-open" : ""}`} points="66,110 174,110 230,-70 10,-70" fill={u("b")} />

      {/* Корпус */}
      <rect x="40" y="108" width="160" height="80" rx="10" fill={u("w")} />
      <path d="M44 134 H196 M44 160 H196" stroke="#2E1708" strokeOpacity="0.55" strokeWidth="2" />
      <rect x="62" y="108" width="18" height="80" fill={u("g")} />
      <rect x="160" y="108" width="18" height="80" fill={u("g")} />
      <rect x="34" y="178" width="172" height="14" rx="6" fill={u("g")} />
      {[71, 169].map((x) =>
        [128, 150, 168].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill="#6B430C" />)
      )}
      <rect x="103" y="114" width="34" height="40" rx="7" fill={u("g")} stroke="#7A4E0E" strokeWidth="1.5" />
      <circle cx="120" cy="130" r="4.5" fill="#2E1708" />
      <rect x="118.2" y="131" width="3.6" height="11" rx="1.5" fill="#2E1708" />

      {/* Сияние внутри, видно, когда крышка отлетела */}
      <ellipse cx="120" cy="110" rx="78" ry="15" fill={u("i")} opacity={open ? 1 : 0} />

      {/* Крышка */}
      <g className={`chest-lid ${open ? "is-open" : ""}`}>
        <path d={LID} fill={u("l")} />
        <g clipPath={u("c")}>
          <rect x="62" y="30" width="18" height="90" fill={u("g")} />
          <rect x="160" y="30" width="18" height="90" fill={u("g")} />
          <ellipse cx="94" cy="62" rx="46" ry="13" fill="#FFFFFF" opacity="0.13" />
        </g>
        <rect x="34" y="98" width="172" height="14" rx="6" fill={u("g")} />
        <rect x="108" y="96" width="24" height="22" rx="5" fill={u("g")} stroke="#7A4E0E" strokeWidth="1.5" />
      </g>

      {/* Свет пробивается из щели, пока сундук трясётся */}
      <rect
        className={`chest-seam ${glow && !open ? "is-on" : ""}`}
        x="44"
        y="109"
        width="152"
        height="5"
        rx="2.5"
        fill="#FFE9A8"
        filter={u("f")}
      />
    </svg>
  );
}

// Фишка: тёмная с золотым ободком, как на колесе.
function ChipArt({ className = "" }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
      <circle cx="40" cy="40" r="34" fill="#1F232A" stroke="#E7B04A" strokeWidth="6" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect
          key={i}
          x="36"
          y="3"
          width="8"
          height="10"
          rx="2"
          fill="#F7E7C2"
          transform={`rotate(${i * 45} 40 40)`}
        />
      ))}
      <circle cx="40" cy="40" r="20" fill="none" stroke="#E7B04A" strokeWidth="2" strokeDasharray="4 4" />
      <circle cx="40" cy="40" r="13" fill="#E7B04A" />
      <circle cx="35" cy="35" r="4" fill="#FFF4CF" opacity="0.7" />
    </svg>
  );
}

function CountUp({ to, delay = 0, duration = 700 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now() + delay;
    const step = (t) => {
      const p = Math.min(1, Math.max(0, (t - start) / duration));
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, delay, duration]);
  return n;
}

function Sparks() {
  const bits = Array.from({ length: 28 }, (_, i) => {
    const ang = (i / 28) * Math.PI * 2 + (i % 4) * 0.13;
    const dist = 110 + (i % 5) * 34;
    return {
      dx: `${Math.round(Math.cos(ang) * dist)}px`,
      dy: `${Math.round(Math.sin(ang) * dist * 0.8 - 40)}px`,
      size: 6 + (i % 3) * 3,
      delay: `${(i % 6) * 35}ms`,
      white: i % 3 === 0,
    };
  });
  return (
    <div className="pointer-events-none absolute left-1/2 top-[55%] h-0 w-0">
      {bits.map((b, i) => (
        <span
          key={i}
          className={`chest-spark absolute left-0 top-0 block rounded-[2px] ${b.white ? "bg-white" : "bg-[#FFD77A]"}`}
          style={{ width: b.size, height: b.size, "--dx": b.dx, "--dy": b.dy, animationDelay: b.delay }}
        />
      ))}
    </div>
  );
}

function RewardCard({ art, amount, label, delay }) {
  return (
    <div
      className="chest-reward w-[136px] rounded-2xl border-2 border-[#E7B04A] bg-gradient-to-b from-[#3A2A12] to-[#1D1A15] px-3 pt-3 pb-3.5 text-center shadow-[0_0_40px_rgba(255,215,122,0.35)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mx-auto w-14 h-14 flex items-center justify-center">{art}</div>
      <p className="mt-1.5 font-display font-bold text-4xl text-[#FFD77A] tabular-nums leading-none">
        ×<CountUp to={amount} delay={delay + 250} />
      </p>
      <p className="mt-1.5 text-sm text-[#F3EFE7]/80">{label}</p>
    </div>
  );
}

export function ChestOpening({ title, onClose, onClaimed }) {
  // drop → ready (ждёт тапа) → shaking (идёт запрос) → open → done
  const [stage, setStage] = useState("drop");
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  const busy = useRef(false);
  const timers = useRef([]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    timers.current.push(
      setTimeout(() => {
        haptic.medium();
        setStage("ready");
      }, 750)
    );
    const list = timers.current;
    return () => {
      document.body.style.overflow = prev;
      list.forEach(clearTimeout);
    };
  }, []);

  async function tap() {
    if (busy.current || stage !== "ready" || error) return;
    busy.current = true;
    haptic.medium();
    setStage("shaking");
    const started = Date.now();
    let r;
    try {
      r = await openChest();
    } catch {
      r = { error: "Не получилось открыть, попробуй ещё раз" };
    }
    // Пусть потрясётся хотя бы секунду, даже если сервер ответил мгновенно.
    await new Promise((ok) => setTimeout(ok, Math.max(0, 1100 - (Date.now() - started))));
    if (!r?.ok) {
      setError(r?.error || "Не получилось открыть, попробуй ещё раз");
      setStage("ready");
      busy.current = false;
      return;
    }
    haptic.heavy();
    setRes(r);
    setStage("open");
    onClaimed?.(r);
    const cards = (r.chips > 0 ? 1 : 0) + (r.spins > 0 ? 1 : 0);
    timers.current.push(
      setTimeout(() => {
        haptic.success();
        setStage("done");
      }, 1100 + cards * 250)
    );
  }

  const opened = stage === "open" || stage === "done";
  const chestClass =
    stage === "drop" ? "chest-drop" : stage === "ready" ? "chest-idle" : stage === "shaking" ? "chest-shake" : "chest-opened";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center overflow-x-hidden overflow-y-auto overscroll-contain select-none pb-[max(24px,env(safe-area-inset-bottom))]"
      style={{ background: "radial-gradient(circle at 50% 58%, #4A3415 0%, #1A1712 48%, #0B0A09 100%)" }}
      role="dialog"
      aria-modal="true"
      onClick={tap}
    >
      {stage !== "shaking" && (
        <button
          type="button"
          aria-label="Закрыть"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] z-20 flex items-center justify-center w-10 h-10 rounded-full border border-white/15 text-[#F3EFE7]/70"
        >
          <Icon name="x" className="w-5 h-5" />
        </button>
      )}

      <div className="relative z-10 mt-[max(44px,calc(env(safe-area-inset-top)+32px))] px-6 text-center">
        <p className="text-sm text-[#E7B04A]">Сундук</p>
        <p className="mt-1 font-display font-bold text-2xl text-[#F3EFE7] leading-tight">{title}</p>
      </div>

      {/* Награды вылетают из сундука сюда */}
      <div className="relative z-10 mt-4 flex h-[min(178px,22vh)] shrink-0 items-end justify-center gap-3">
        {opened && res?.chips > 0 && (
          <RewardCard art={<ChipArt className="w-14 h-14" />} amount={res.chips} label={chipsNom(res.chips)} delay={150} />
        )}
        {opened && res?.spins > 0 && (
          <RewardCard
            art={<Icon name="wheel" className="w-12 h-12 text-[#FFD77A]" />}
            amount={res.spins}
            label={spinsNom(res.spins)}
            delay={res.chips > 0 ? 400 : 150}
          />
        )}
      </div>

      <div className="relative mt-2 shrink-0" style={{ height: "min(265px, 32vh)", aspectRatio: "260 / 230" }}>
        {opened && (
          <div
            className="chest-rays pointer-events-none absolute left-1/2 top-[52%] w-[640px] h-[640px] rounded-full"
            style={{
              background:
                "repeating-conic-gradient(from 0deg, rgba(255,215,122,0.22) 0deg 7deg, rgba(255,215,122,0) 7deg 22deg)",
              WebkitMaskImage: "radial-gradient(circle, #000 18%, transparent 62%)",
              maskImage: "radial-gradient(circle, #000 18%, transparent 62%)",
            }}
          />
        )}
        <div className="absolute left-1/2 bottom-3 h-5 w-48 -translate-x-1/2 rounded-[50%] bg-black/55 blur-md" />
        <div className={`absolute inset-x-[10px] bottom-0 ${chestClass}`}>
          <ChestArt open={opened} glow={stage === "shaking"} className="w-full h-auto" />
        </div>
        {opened && <Sparks />}
      </div>

      <div className="relative z-10 mt-4 w-full max-w-xs px-6 text-center">
        {error ? (
          <div className="space-y-4">
            <p className="text-[#F3EFE7]">{error}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-full rounded-2xl bg-acid-400 text-black font-bold py-3"
            >
              Закрыть
            </button>
          </div>
        ) : stage === "ready" ? (
          <p className="chest-hint font-semibold text-[#FFD77A]">Нажми на сундук</p>
        ) : stage === "done" && res ? (
          <div className="wheel-pop space-y-3">
            <p className="text-sm text-[#F3EFE7]/75">
              {res.chips > 0 && (
                <>
                  Теперь у тебя {res.totalChips} {chipsNom(res.totalChips)}
                </>
              )}
              {res.chips > 0 && res.spins > 0 && " и "}
              {res.spins > 0 && (
                <>
                  {res.chips > 0 ? "" : "Теперь у тебя "}
                  {res.totalSpins} {spinsNom(res.totalSpins)}
                </>
              )}
            </p>
            <Link
              href="/mop/games/wheel"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="flex items-center justify-center gap-2 w-full rounded-2xl bg-acid-400 text-black font-bold py-3 active:scale-[.98] transition"
            >
              <Icon name="wheel" className="w-5 h-5" />
              К колесу фортуны
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-full rounded-2xl border border-white/15 text-[#F3EFE7]/80 font-semibold py-3"
            >
              Готово
            </button>
          </div>
        ) : null}
      </div>

      {stage === "open" && <div className="chest-flash pointer-events-none absolute inset-0 z-30 bg-[#FFF6DA]" />}
    </div>,
    document.body
  );
}

// Карточка «Тебе сундук» на главной и в «Играх».
export default function ChestCard({ chest }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!chest || (claimed && !show)) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setShow(true)}
        className="flex w-full items-center gap-4 rounded-2xl border border-acid-400/50 bg-gradient-to-br from-acid-400/20 via-dark-800 to-dark-800 py-3.5 pl-3 pr-4 text-left active:scale-[.99] transition"
      >
        <span className="relative w-[76px] h-[64px] shrink-0">
          <span className="absolute inset-2 rounded-full bg-[#FFD77A]/30 blur-xl" />
          <ChestArt className="chest-card-bob relative w-full h-full" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-acid-400">Тебе сундук</span>
          <span className="block font-bold leading-tight line-clamp-2 mt-0.5">{chest.title}</span>
        </span>
        <span className="shrink-0 rounded-xl bg-acid-400 text-black font-bold text-sm px-3.5 py-2">Открыть</span>
      </button>
      {mounted && show && (
        <ChestOpening
          title={chest.title}
          onClaimed={() => setClaimed(true)}
          onClose={() => {
            setShow(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
