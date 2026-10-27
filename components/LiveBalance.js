"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { haptic } from "@/lib/haptics";
import { monthRangeAlmaty, currentMonthKeyAlmaty } from "@/lib/timezone";

const SIZE = 232;
const STROKE = 9;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Плавный счётчик от прошлого значения к новому.
function useCountUp(target, duration = 650) {
  const [val, setVal] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    if (from === target) {
      setVal(target);
      return;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return val;
}

export default function LiveBalance({
  userId,
  initialBalance,
  initialTotalEarned,
  initialMonthEarned,
  goalTarget = null,
  goalTitle = null,
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [totalEarned, setTotalEarned] = useState(initialTotalEarned);
  const [monthEarned, setMonthEarned] = useState(initialMonthEarned);
  const [floaters, setFloaters] = useState([]);

  const shownBalance = useCountUp(balance);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let alive = true;
    let channel;

    async function start() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`balance-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${userId}`,
          },
          async (payload) => {
            const delta = payload.new?.amount_coins ?? 0;
            if (!delta || !alive) return;

            // Источник правды — перечитываем строку пользователя (баланс,
            // всего заработано) и агрегат по транзакциям текущего месяца
            // (month_earned как отдельная колонка больше не существует —
            // она никогда не обнулялась и всегда совпадала с total_earned).
            const { start, end } = monthRangeAlmaty(currentMonthKeyAlmaty());
            const [{ data: fresh }, { data: monthRows }] = await Promise.all([
              supabase
                .from("users")
                .select("balance, total_earned")
                .eq("id", userId)
                .single(),
              supabase.rpc("earned_in_range", {
                p_user_ids: [userId],
                p_start: start,
                p_end: end,
              }),
            ]);

            if (!alive) return;

            if (fresh) {
              setBalance(fresh.balance);
              setTotalEarned(fresh.total_earned);
              setMonthEarned(monthRows?.[0]?.total ?? 0);
            } else {
              setBalance((b) => b + delta);
            }

            const id = `${Date.now()}-${Math.random()}`;
            setFloaters((f) => [...f, { id, delta }]);
            setTimeout(
              () => setFloaters((f) => f.filter((x) => x.id !== id)),
              1800
            );
            haptic.success();
          }
        )
        .subscribe();
    }

    start();

    const { data: authSub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
    });

    return () => {
      alive = false;
      authSub?.subscription?.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId]);

  const fmt = (n) => Number(n).toLocaleString("ru-RU");

  const pct = goalTarget > 0 ? Math.min(100, (balance / goalTarget) * 100) : 0;
  const offset = CIRCUMFERENCE * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center">
      {/* Монета: литой диск с ободом. Дуга по ободу показывает путь до цели,
          а сама цель описана карточкой ниже, без дублей. */}
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <div
          className="absolute rounded-full opacity-70"
          style={{
            inset: -18,
            background:
              "radial-gradient(closest-side, rgb(var(--c-accent) / 0.16), transparent)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            inset: STROKE - 1,
            background:
              "radial-gradient(120% 120% at 32% 18%, rgb(var(--c-coin-1)) 0%, rgb(var(--c-coin-2)) 58%, rgb(var(--c-coin-3)) 100%)",
            boxShadow:
              "inset 0 2px 0 rgb(255 255 255 / 0.06), inset 0 -10px 24px rgb(0 0 0 / 0.35), 0 12px 32px rgb(0 0 0 / 0.45)",
          }}
        />
        {/* тонкий внутренний кант, как на настоящей монете */}
        <div
          className="absolute rounded-full border border-acid-400/25"
          style={{ inset: STROKE + 12 }}
        />

        <svg width={SIZE} height={SIZE} className="relative -rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
            className="stroke-dark-700"
            fill="none"
          />
          {pct > 0 && (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              className="stroke-acid-400 transition-[stroke-dashoffset] duration-1000 ease-out"
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="relative">
            <span className="block font-display text-[42px] leading-none font-extrabold tracking-tight tabular-nums">
              {fmt(shownBalance)}
            </span>
            {floaters.map((f) => (
              <span
                key={f.id}
                className={`balance-floater pointer-events-none absolute left-full top-1 ml-2 whitespace-nowrap text-base font-bold ${
                  f.delta > 0 ? "text-acid-400" : "text-red-400"
                }`}
              >
                {f.delta > 0 ? `+${fmt(f.delta)}` : fmt(f.delta)}
              </span>
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-2 tracking-wide">коинов</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-acid-400/10 border border-acid-400/25 px-3 py-1.5 text-sm text-acid-400">
          <span className="font-display font-medium tabular-nums">+{fmt(monthEarned)}</span>
          <span className="text-xs text-gray-400">в этом месяце</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-dark-800 border border-dark-700 px-3 py-1.5 text-sm">
          <span className="font-display font-medium tabular-nums">{fmt(totalEarned)}</span>
          <span className="text-xs text-gray-500">за всё время</span>
        </span>
      </div>
    </div>
  );
}
