"use client";

import { useRef, useState, useTransition } from "react";
import { spinWheel, buySpin } from "@/app/mop/wheel/actions";
import { segmentColor } from "@/lib/wheel";
import { haptic } from "@/lib/haptics";

const CX = 150;
const CY = 150;
const R = 140;

function polar(angleDeg, radius) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
}

function slicePath(startDeg, endDeg) {
  const [x0, y0] = polar(startDeg, R);
  const [x1, y1] = polar(endDeg, R);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
}

export default function WheelClient({
  segments,
  spins: initialSpins,
  balance: initialBalance,
  config,
}) {
  const [isPending, startTransition] = useTransition();
  const [spins, setSpins] = useState(initialSpins ?? 0);
  const [balance, setBalance] = useState(initialBalance ?? 0);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const rotationRef = useRef(0);

  const n = segments.length;
  const slice = n > 0 ? 360 / n : 360;

  function handleSpin() {
    if (spinning || isPending || spins <= 0) return;
    setError(null);
    setResult(null);
    setSpinning(true);
    haptic.medium?.();

    startTransition(async () => {
      const res = await spinWheel();
      if (res?.error) {
        setSpinning(false);
        setError(res.error);
        return;
      }

      const center = res.index * slice + slice / 2;
      const jitter = (Math.random() - 0.5) * slice * 0.6;
      const landing = 360 - center - jitter;
      const prev = rotationRef.current;
      const next = prev - (prev % 360) + 360 * 6 + landing;
      rotationRef.current = next;
      setRotation(next);

      window.setTimeout(() => {
        setSpinning(false);
        setSpins(res.spins);
        setBalance(res.balance);
        setResult(res);
        if (res.prizeType === "nothing") haptic.light?.();
        else haptic.success?.();
      }, 4300);
    });
  }

  function handleBuy() {
    if (isPending || spinning) return;
    setError(null);
    startTransition(async () => {
      const res = await buySpin();
      if (res?.error) {
        setError(res.error);
        return;
      }
      setSpins(res.spins);
      setBalance((b) => b - config.spin_price_coins);
    });
  }

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">🎡 Колесо фортуны</h1>
        <p className="text-sm text-gray-500 mt-1">
          Крутки капают за полезные действия. Приз начисляется сразу.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-dark-800 border border-dark-600 p-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">
            Круток
          </p>
          <p className="text-3xl font-black text-acid-400 tabular-nums">
            {spins}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase tracking-wider">
            Баланс
          </p>
          <p className="text-xl font-bold tabular-nums">
            {balance.toLocaleString("ru-RU")}
          </p>
        </div>
      </div>

      {n === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">
          Колесо ещё не настроено.
        </p>
      ) : (
        <div className="relative mx-auto w-full max-w-[320px] aspect-square">
          {/* стрелка */}
          <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-10">
            <div className="w-0 h-0 border-x-[12px] border-x-transparent border-t-[20px] border-t-acid-400 drop-shadow" />
          </div>

          <svg
            viewBox="0 0 300 300"
            className="w-full h-full"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning
                ? "transform 4.2s cubic-bezier(0.16, 0.84, 0.16, 1)"
                : "none",
            }}
          >
            <circle
              cx={CX}
              cy={CY}
              r={R + 4}
              fill="#0a0a0a"
              stroke="#27272a"
              strokeWidth="4"
            />
            {segments.map((seg, i) => {
              const start = i * slice;
              const end = (i + 1) * slice;
              const mid = start + slice / 2;
              const [lx, ly] = polar(mid, R * 0.62);
              return (
                <g key={seg.id}>
                  <path
                    d={slicePath(start, end)}
                    fill={segmentColor(seg, i)}
                    stroke="#0a0a0a"
                    strokeWidth="1.5"
                  />
                  <text
                    x={lx}
                    y={ly}
                    fill="#fff"
                    fontSize="11"
                    fontWeight="700"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${mid}, ${lx}, ${ly})`}
                  >
                    {seg.label.length > 16
                      ? seg.label.slice(0, 15) + "…"
                      : seg.label}
                  </text>
                </g>
              );
            })}
            <circle
              cx={CX}
              cy={CY}
              r="26"
              fill="#0a0a0a"
              stroke="#a3ff12"
              strokeWidth="3"
            />
          </svg>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 text-center">{error}</p>
      )}

      {result && (
        <div
          className={`rounded-2xl border p-4 text-center ${
            result.prizeType === "nothing"
              ? "border-dark-600 bg-dark-800 text-gray-400"
              : "border-acid-400/40 bg-acid-400/10 text-acid-400"
          }`}
        >
          <p className="text-lg font-bold">
            {result.prizeType === "nothing"
              ? "Мимо 😐"
              : `🎉 ${result.resultText}`}
          </p>
          <p className="text-xs text-gray-500 mt-1">Сектор: {result.label}</p>
        </div>
      )}

      <button
        onClick={handleSpin}
        disabled={spinning || isPending || spins <= 0 || n === 0}
        className="w-full bg-acid-400 text-black font-bold rounded-xl py-3.5 text-base disabled:opacity-40"
      >
        {spinning ? "Крутится…" : spins > 0 ? "Крутить" : "Круток нет"}
      </button>

      {config?.buy_enabled && (
        <button
          onClick={handleBuy}
          disabled={
            isPending ||
            spinning ||
            balance < (config.spin_price_coins ?? 0)
          }
          className="w-full bg-dark-800 border border-dark-600 text-gray-300 rounded-xl py-3 text-sm disabled:opacity-40"
        >
          Купить крутку за {config.spin_price_coins.toLocaleString("ru-RU")}{" "}
          coins
        </button>
      )}
    </div>
  );
}
