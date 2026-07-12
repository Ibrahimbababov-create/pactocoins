"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingTelegram, setCheckingTelegram] = useState(true);
  const [debug, setDebug] = useState("Запуск проверки...");

  useEffect(() => {
    let cancelled = false;

    function attempt(retriesLeft) {
      const tg = window?.Telegram?.WebApp;

      if (!tg) {
        if (retriesLeft > 0) {
          setDebug(`Ждём загрузку Telegram SDK... (${retriesLeft})`);
          setTimeout(() => attempt(retriesLeft - 1), 300);
          return;
        }
        setDebug("Telegram SDK не найден (window.Telegram.WebApp пуст)");
        setCheckingTelegram(false);
        return;
      }

      tg.ready();
      tg.expand();

      if (!tg.initData) {
        setDebug(
          `SDK найден, но initData пустой. platform: ${tg.platform}, version: ${tg.version}`
        );
        setCheckingTelegram(false);
        return;
      }

      setDebug("initData найден, отправляем на сервер...");

      fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: tg.initData }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (cancelled) return;

          if (data.redirect) {
            setDebug(`Успех, редирект на ${data.redirect}`);
            router.push(data.redirect);
            router.refresh();
          } else {
            setDebug(`Сервер вернул ошибку: ${data.error ?? "неизвестно"}`);
            setCheckingTelegram(false);
          }
        })
        .catch((err) => {
          if (cancelled) return;
          setDebug(`Ошибка запроса: ${err.message}`);
          setCheckingTelegram(false);
        });
    }

    attempt(10);

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError("Неверный email или пароль");
      return;
    }

    router.refresh();
    router.push("/mop");
  }

  if (checkingTelegram) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900 px-4">
        <p className="text-gray-500 text-sm text-center">{debug}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-dark-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-4">
          <h1 className="text-4xl font-black tracking-tight">
            Pacto<span className="text-acid-400">Coins</span>
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Внутренняя система коинов отдела продаж
          </p>
        </div>

        <p className="text-center text-xs text-gray-600 mb-4 break-words">
          [диагностика] {debug}
        </p>

        <form
          onSubmit={handleLogin}
          className="bg-dark-800 border border-dark-600 rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-acid-400"
              placeholder="you@pacto.kz"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-acid-400"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-acid-400 text-black font-bold rounded-lg py-3 hover:bg-acid-500 transition disabled:opacity-50"
          >
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
