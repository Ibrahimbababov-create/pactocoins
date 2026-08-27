"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { haptic } from "@/lib/haptics";

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

            // Источник правды — перечитываем строку пользователя.
            const { data: fresh } = await supabase
              .from("users")
              .select("balance, total_earned, month_earned")
              .eq("id", userId)
              .single();

            if (!alive) return;

            if (fresh) {
              setBalance(fresh.balance);
              setTotalEarned(fresh.total_earned);
              setMonthEarned(fresh.month_earned);
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

  return (
    <div className="relative overflow-hidden rounded-3xl p-6 border border-acid-400/20 bg-gradient-to-br from-[#18220b] via-dark-800 to-dark-800 shadow-[0_0_50px_-16px_rgba(163,255,18,0.3)]">
      {/* тонкий световой блик по верхней кромке */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <p className="text-gray-400 text-xs uppercase tracking-widest">
        Текущий баланс
      </p>

      <div className="relative mt-1 inline-block">
        <span className="block text-6xl font-black text-acid-400 tracking-tight tabular-nums">
          {fmt(shownBalance)}
        </span>
        {floaters.map((f) => (
          <span
            key={f.id}
            className={`balance-floater pointer-events-none absolute left-full top-1 ml-2 whitespace-nowrap text-lg font-bold ${
              f.delta > 0 ? "text-acid-400" : "text-red-400"
            }`}
          >
            {f.delta > 0 ? `↑ +${fmt(f.delta)}` : `↓ ${fmt(f.delta)}`}
          </span>
        ))}
      </div>

      <p className="text-gray-500 text-sm mt-1">coins</p>

      <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
        <div>
          <p className="text-gray-400 text-[11px] uppercase tracking-wider">
            Всего заработано
          </p>
          <p className="text-xl font-bold tabular-nums mt-0.5">
            {fmt(totalEarned)}
          </p>
        </div>
        <div>
          <p className="text-gray-400 text-[11px] uppercase tracking-wider">
            За этот месяц
          </p>
          <p className="text-xl font-bold tabular-nums mt-0.5">
            {fmt(monthEarned)}
          </p>
        </div>
      </div>
    </div>
  );
}
