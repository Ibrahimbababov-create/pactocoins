"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/Icon";
import { LATEST_WHATS_NEW, slidesForRole } from "@/lib/whatsNew";
import { REVENUE_TIERS } from "@/lib/coinRate";
import { haptic } from "@/lib/haptics";

const SEEN_KEY = "whats_new_seen";
export const OPEN_WHATS_NEW_EVENT = "pc:whats-new";

function TiersVisual() {
  return (
    <div className="mt-5 space-y-2 text-left">
      {REVENUE_TIERS.map((t, i) => {
        const to = REVENUE_TIERS[i + 1];
        const range = to
          ? `${i === 0 ? "до" : "от " + t.label + " до"} ${to.label}`
          : `от ${t.label}`;
        return (
          <div
            key={t.from}
            className="flex items-center justify-between rounded-xl border border-dark-600 bg-dark-900/60 px-4 py-3"
            style={{ animation: `wn-rise 400ms ${150 + i * 120}ms both` }}
          >
            <span className="text-sm text-gray-400">{range}</span>
            <span
              className="font-display font-bold tabular-nums"
              style={{ color: `rgb(var(--c-accent) / ${0.55 + i * 0.22})` }}
            >
              {t.rate} {t.rate === 1 ? "коин" : "коина"}
            </span>
          </div>
        );
      })}
      <p className="text-xs text-gray-500 pt-1">
        За каждые 1000 ₸ выручки. Порог — сколько ты закрыл с 1 числа месяца.
      </p>
    </div>
  );
}

// Окно «Что нового» в стиле историй: полоски прогресса, крупная иконка,
// свайп и кнопки. Показывается один раз на устройстве для каждого
// обновления (localStorage), повторно — из «Ещё». Рендер через портал в
// body: у обёрток страниц бывает transform, и fixed-окно уехало бы.
export default function WhatsNew({ role }) {
  const release = LATEST_WHATS_NEW;
  const slides = slidesForRole(release, role);
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const touchX = useRef(null);

  useEffect(() => {
    if (!release || !slides.length) return;
    let seen = null;
    try {
      seen = localStorage.getItem(SEEN_KEY);
    } catch {
      /* приватный режим — покажем */
    }
    if (seen !== release.id) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [release, slides.length]);

  useEffect(() => {
    const reopen = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_WHATS_NEW_EVENT, reopen);
    return () => window.removeEventListener(OPEN_WHATS_NEW_EVENT, reopen);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setI(0);
    try {
      localStorage.setItem(SEEN_KEY, release.id);
    } catch {
      /* не критично */
    }
  }, [release]);

  const next = useCallback(() => {
    haptic.light();
    if (i >= slides.length - 1) close();
    else setI((v) => v + 1);
  }, [i, slides.length, close]);

  const prev = useCallback(() => setI((v) => Math.max(0, v - 1)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, next, prev, close]);

  if (!open || !slides.length) return null;
  const s = slides[i];
  const last = i === slides.length - 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/75 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={release.title}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (dx < -40) next();
        else if (dx > 40) prev();
      }}
    >
      <style>{`
        @keyframes wn-pop { from { opacity: 0; transform: translateY(16px) scale(.97) } to { opacity: 1; transform: none } }
        @keyframes wn-rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        @keyframes wn-glow { 0%,100% { box-shadow: 0 0 0 0 rgb(var(--c-accent) / .35) } 50% { box-shadow: 0 0 0 14px rgb(var(--c-accent) / 0) } }
        @keyframes wn-bar { from { transform: scaleX(0) } to { transform: scaleX(1) } }
      `}</style>

      <div
        key={i}
        className="relative w-full max-w-md rounded-3xl border border-dark-600 bg-dark-800 px-6 pt-5 pb-6 text-center shadow-2xl"
        style={{ animation: "wn-pop 320ms cubic-bezier(.2,.8,.2,1) both" }}
      >
        <div className="flex gap-1.5">
          {slides.map((_, k) => (
            <div key={k} className="h-1 flex-1 rounded-full bg-dark-600 overflow-hidden">
              <div
                className="h-full bg-acid-400 origin-left"
                style={{
                  transform: k < i ? "scaleX(1)" : "scaleX(0)",
                  animation: k === i ? "wn-bar 500ms ease-out both" : undefined,
                }}
              />
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-500">{release.title}</span>
          <button
            type="button"
            onClick={close}
            aria-label="Закрыть"
            className="-mr-2 w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-300"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div
          className="mx-auto mt-3 w-20 h-20 rounded-full bg-acid-400/15 border border-acid-400/40 flex items-center justify-center"
          style={{ animation: "wn-glow 2.2s ease-in-out infinite" }}
        >
          <Icon name={s.icon} className="w-10 h-10 text-acid-400" />
        </div>

        <h2
          className="mt-5 font-display text-xl font-bold leading-tight"
          style={{ animation: "wn-rise 380ms 60ms both" }}
        >
          {s.title}
        </h2>
        <p
          className="mt-3 text-sm text-gray-400 leading-relaxed"
          style={{ animation: "wn-rise 380ms 120ms both" }}
        >
          {s.text}
        </p>

        {s.tiers && <TiersVisual />}

        <div className="mt-6 flex items-center gap-3">
          {i > 0 && (
            <button
              type="button"
              onClick={prev}
              className="w-12 h-12 shrink-0 rounded-2xl border border-dark-600 flex items-center justify-center text-gray-400"
              aria-label="Назад"
            >
              <Icon name="chevronLeft" className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className="flex-1 h-12 rounded-2xl bg-acid-400 text-black font-bold active:scale-[.98] transition"
          >
            {last ? "Погнали" : "Дальше"}
          </button>
        </div>
        <p className="mt-3 text-[11px] text-gray-600">
          {i + 1} из {slides.length}
        </p>
      </div>
    </div>,
    document.body
  );
}

// Кнопка «Что нового» — для меню «Ещё»: открывает окно ещё раз.
export function WhatsNewButton({ className = "", children }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(OPEN_WHATS_NEW_EVENT))}
    >
      {children}
    </button>
  );
}
