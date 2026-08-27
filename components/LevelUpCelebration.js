"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markLevelCelebrated } from "@/app/mop/actions";
import { haptic } from "@/lib/haptics";

const CONFETTI_COLORS = [
  "#a3ff12",
  "#8cf000",
  "#ffd21f",
  "#ff5c8a",
  "#4fd1ff",
  "#ffffff",
];

export default function LevelUpCelebration({ level }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pieces, setPieces] = useState([]);
  const dismissedRef = useRef(false);

  // Конфетти генерируем только на клиенте — иначе рассинхрон гидрации.
  useEffect(() => {
    haptic.success();
    const next = Array.from({ length: 70 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      drift: `${(Math.random() - 0.5) * 40}vw`,
      delay: Math.random() * 0.6,
      duration: 2.6 + Math.random() * 1.8,
      size: 6 + Math.random() * 8,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rounded: Math.random() > 0.5,
    }));
    setPieces(next);
  }, []);

  function dismiss() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    startTransition(async () => {
      await markLevelCelebrated();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 text-center bg-dark-900/95 backdrop-blur-sm"
      style={{ animation: "levelup-fade 0.25s ease-out" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p) => (
          <span
            key={p.id}
            className="levelup-confetti-piece absolute top-0 block"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              background: p.color,
              borderRadius: p.rounded ? "9999px" : "2px",
              "--drift": p.drift,
              animation: `levelup-confetti ${p.duration}s linear ${p.delay}s forwards`,
            }}
          />
        ))}
      </div>

      <div
        className="relative"
        style={{ animation: "levelup-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      >
        <p className="text-sm font-semibold uppercase tracking-widest text-acid-400">
          Новый ранг
        </p>
        <div className="my-4 text-8xl leading-none">{level.icon}</div>
        <h2 className="text-3xl font-black">{level.name}</h2>
        <p className="mt-3 text-sm text-gray-400">
          Ты заработал уже {level.min.toLocaleString("ru-RU")}+ coins. Так держать!
        </p>
      </div>

      <button
        onClick={dismiss}
        disabled={isPending}
        className="relative mt-10 rounded-2xl bg-acid-400 px-8 py-3 font-bold text-black transition active:scale-95 disabled:opacity-50"
      >
        Круто 🔥
      </button>
    </div>
  );
}
