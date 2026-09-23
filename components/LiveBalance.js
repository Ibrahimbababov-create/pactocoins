"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { haptic } from "@/lib/haptics";
import { monthRangeAlmaty, currentMonthKeyAlmaty } from "@/lib/timezone";

const SIZE = 208;
const STROKE = 10;
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
    <div className="relative overflow-hidden rounded-3xl p-6 border border-acid-400/20 bg-gradient-to-br from-[#18220b] via-dark-800 to-dark-800 shadow-[0_0_50px_-16px_rgba(163,255,18,0.3)]">
      {/* тонкий световой блик по верхней кромке */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              strokeWidth={STROKE}
              className="stroke-dark-600"
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
            <p className="text-gray-500 text-[11px] uppercase tracking-widest">
              Баланс
            </p>
            <div className="relative mt-1">
              <span className="block text-4xl font-black text-acid-400 tracking-tight tabular-nums">
                {fmt(shownBalance)}
              </span>
              {floaters.map((f) => (
                <span
                  key={f.id}
                  className={`balance-floater pointer-events-none absolute left-full top-1 ml-2 whitespace-nowrap text-base font-bold ${
                    f.delta > 0 ? "text-acid-400" : "text-red-400"
                  }`}
                >
                  {f.delta > 0 ? `↑ +${fmt(f.delta)}` : `↓ ${fmt(f.delta)}`}
                </span>
              ))}
            </div>
            <p className="text-gray-500 text-xs mt-1">коинов</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-white/10 w-full">
          <div className="text-center">
            <p className="text-gray-400 text-[11px] uppercase tracking-wider">
              За этот месяц
            </p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {fmt(monthEarned)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-[11px] uppercase tracking-wider">
              Всего заработано
            </p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {fmt(totalEarned)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
