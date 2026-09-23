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
  const remainingToGoal = goalTarget > 0 ? Math.max(0, goalTarget - balance) : 0;

  return (
    <div className="flex flex-col items-center">
      {/* Монета: тёмный диск, по краю — кольцо прогресса до цели.
          Никакой карточки вокруг: монета и есть главный объект экрана. */}
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <div
          className="absolute rounded-full border border-dark-600"
          style={{
            inset: STROKE - 1,
            background:
              "radial-gradient(120% 120% at 32% 20%, rgb(var(--c-coin-1)) 0%, rgb(var(--c-coin-2)) 58%, rgb(var(--c-coin-3)) 100%)",
          }}
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
          {goalTitle && (
            <p className="text-[11px] font-semibold text-acid-400 px-6 text-center truncate max-w-full">
              коплю на {goalTitle}
            </p>
          )}
          <div className="relative mt-0.5">
            <span className="block font-display text-[38px] leading-none font-extrabold tracking-tight tabular-nums">
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
          <p className="text-gray-500 text-xs mt-1.5">коинов</p>
        </div>
      </div>

      {goalTitle && remainingToGoal > 0 && (
        <p className="text-xs text-gray-500 mt-2.5">
          До цели осталось {fmt(remainingToGoal)}
        </p>
      )}

      <div className="flex items-center w-full border-y border-dark-700 py-3 mt-4">
        <div className="flex-1">
          <p className="text-xs text-gray-500">Заработано в этом месяце</p>
          <p className="font-display text-[17px] font-medium tabular-nums mt-1">
            {fmt(monthEarned)}
          </p>
        </div>
        <div className="w-px h-8 bg-dark-700" />
        <div className="flex-1 pl-4">
          <p className="text-xs text-gray-500">Всего заработано</p>
          <p className="font-display text-[17px] font-medium tabular-nums mt-1">
            {fmt(totalEarned)}
          </p>
        </div>
      </div>
    </div>
  );
}
