"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const API_URL = "https://pactocoins.vercel.app/api/auth/telegram";
const GUEST_API_URL = "https://pactocoins.vercel.app/api/auth/guest";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingTelegram, setCheckingTelegram] = useState(true);
  const [debug, setDebug] = useState("Запуск проверки...");
  const cancelledRef = useRef(false);

  // Новый пользователь через Telegram, аккаунта ещё нет —
  // показываем выбор "гость / зарегистрироваться" вместо тихого
  // автосоздания аккаунта.
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [pendingInitData, setPendingInitData] = useState(null);
  const [onboardingMode, setOnboardingMode] = useState("choice"); // choice | register
  const [registerName, setRegisterName] = useState("");
  const [onboardingError, setOnboardingError] = useState("");
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  // Заявка на регистрацию отправлена и ждёт, пока админ подтвердит
  // её в Telegram — своего аккаунта у человека пока нет.
  const [pendingRequest, setPendingRequest] = useState(false);

  function doTelegramLogin(initData, displayName) {
    setDebug("initData найден, отправляем на сервер (XHR)...");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_URL, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.withCredentials = true;

    xhr.onload = function () {
      if (cancelledRef.current) return;
      try {
        const data = JSON.parse(xhr.responseText);

        if (data.pending) {
          setNeedsOnboarding(false);
          setPendingRequest(true);
          setCheckingTelegram(false);
          setOnboardingLoading(false);
          return;
        }

        if (data.needsOnboarding) {
          setPendingInitData(initData);
          setNeedsOnboarding(true);
          setCheckingTelegram(false);
          setOnboardingLoading(false);
          return;
        }

        if (data.redirect) {
          setDebug(`Успех, редирект на ${data.redirect}`);
          router.push(data.redirect);
          router.refresh();
        } else {
          setDebug(`Сервер вернул ошибку: ${data.error ?? "неизвестно"}`);
          setCheckingTelegram(false);
          setOnboardingLoading(false);
          setOnboardingError(data.error || "Не получилось");
        }
      } catch (e) {
        setDebug(
          `Не удалось разобрать ответ (status ${xhr.status}): ${xhr.responseText.slice(
            0,
            200
          )}`
        );
        setCheckingTelegram(false);
        setOnboardingLoading(false);
      }
    };

    xhr.onerror = function () {
      if (cancelledRef.current) return;
      setDebug(`Ошибка сети XHR (status ${xhr.status})`);
      setCheckingTelegram(false);
      setOnboardingLoading(false);
    };

    xhr.send(JSON.stringify({ initData, displayName }));
  }

  useEffect(() => {
    cancelledRef.current = false;

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

      doTelegramLogin(tg.initData);
    }

    attempt(10);

    return () => {
      cancelledRef.current = true;
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

  function handleManualTelegramLogin() {
    const tg = window?.Telegram?.WebApp;
    if (tg?.initData) {
      setCheckingTelegram(true);
      doTelegramLogin(tg.initData);
    } else {
      setDebug("Telegram WebApp недоступен на этом экране");
    }
  }

  function handleRegisterSubmit(e) {
    e.preventDefault();
    if (!registerName.trim()) {
      setOnboardingError("Введи имя");
      return;
    }
    setOnboardingError("");
    setOnboardingLoading(true);
    doTelegramLogin(pendingInitData, registerName.trim());
  }

  function handleGuestLogin() {
    setOnboardingError("");
    setOnboardingLoading(true);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", GUEST_API_URL, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.withCredentials = true;

    xhr.onload = function () {
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.redirect) {
          router.push(data.redirect);
          router.refresh();
        } else {
          setOnboardingLoading(false);
          setOnboardingError(data.error || "Не получилось войти как гость");
        }
      } catch {
        setOnboardingLoading(false);
        setOnboardingError("Не получилось войти как гость");
      }
    };

    xhr.onerror = function () {
      setOnboardingLoading(false);
      setOnboardingError("Ошибка сети");
    };

    xhr.send(JSON.stringify({}));
  }

  if (checkingTelegram) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900 px-4">
        <p className="text-gray-500 text-sm text-center">{debug}</p>
      </div>
    );
  }

  if (pendingRequest) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-dark-900">
        <div className="w-full max-w-sm text-center">
          <p className="text-5xl mb-4">⏳</p>
          <h1 className="text-2xl font-bold mb-2">Заявка отправлена</h1>
          <p className="text-gray-500 text-sm">
            Админ уже получил уведомление и скоро подтвердит регистрацию.
            Как только это произойдёт — просто открой приложение заново.
          </p>
        </div>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-dark-900">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-black tracking-tight">
              Pacto<span className="text-acid-400">Coins</span>
            </h1>
            <p className="text-gray-500 mt-2 text-sm">
              Привет! Это внутренняя система коинов отдела продаж — за
              выручку и достижения начисляются coins, которые можно
              обменять на реальные штуки в магазине.
            </p>
          </div>

          {onboardingError && (
            <p className="text-red-400 text-sm text-center mb-3">
              {onboardingError}
            </p>
          )}

          {onboardingMode === "choice" ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleGuestLogin}
                disabled={onboardingLoading}
                className="bg-dark-800 border border-dark-600 rounded-2xl p-4 text-left disabled:opacity-50"
              >
                <p className="font-bold">👀 Попробовать</p>
                <p className="text-xs text-gray-500 mt-1">
                  Демо-доступ, чтобы посмотреть как всё устроено
                </p>
              </button>
              <button
                onClick={() => setOnboardingMode("register")}
                disabled={onboardingLoading}
                className="bg-acid-400 text-black rounded-2xl p-4 text-left disabled:opacity-50"
              >
                <p className="font-bold">✅ Зарегистрироваться</p>
                <p className="text-xs mt-1 opacity-70">
                  Заявка админу, обычно быстро
                </p>
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleRegisterSubmit}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-6 space-y-4"
            >
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Как тебя зовут?
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="Имя Фамилия"
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-acid-400"
                />
              </div>
              <button
                type="submit"
                disabled={onboardingLoading}
                className="w-full bg-acid-400 text-black font-bold rounded-lg py-3 hover:bg-acid-500 transition disabled:opacity-50"
              >
                {onboardingLoading ? "..." : "Отправить заявку"}
              </button>
              <button
                type="button"
                onClick={() => setOnboardingMode("choice")}
                className="w-full text-xs text-gray-500"
              >
                Назад
              </button>
            </form>
          )}
        </div>
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

        <button
          onClick={handleManualTelegramLogin}
          className="w-full bg-[#2AABEE] text-white font-bold rounded-lg py-3 mb-4"
        >
          Войти через Telegram
        </button>

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
