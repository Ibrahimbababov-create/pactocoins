"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import NewsText from "@/components/NewsText";
import { markNewsRead } from "@/app/mop/newsActions";

const SKIP_KEY = "news_skipped";

function skipped() {
  try {
    return JSON.parse(sessionStorage.getItem(SKIP_KEY) || "[]");
  } catch {
    return [];
  }
}
function addSkipped(id) {
  try {
    sessionStorage.setItem(SKIP_KEY, JSON.stringify([...skipped(), id]));
  } catch {
    /* не критично */
  }
}

// Окно с важной непрочитанной новостью. Закрыть можно только кнопкой
// «Прочитал(а)». Если отметить не вышло (сеть), через 5 секунд появляется
// «Закрыть», чтобы приложение не зависло. Окно в портале: у обёрток страниц
// бывает transform, и fixed-окно уехало бы.
export default function ImportantNewsModal({ items }) {
  const router = useRouter();
  const [queue, setQueue] = useState(null); // null, пока не посмотрели sessionStorage
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const skip = skipped();
    const list = items.filter((n) => !skip.includes(n.id));
    if (!list.length) return;
    const t = setTimeout(() => setQueue(list), 900);
    return () => clearTimeout(t);
  }, [items]);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!queue?.length) return null;
  const n = queue[0];

  const next = () => {
    setFailed(false);
    setCanClose(false);
    setBusy(false);
    clearTimeout(timer.current);
    const rest = queue.slice(1);
    setQueue(rest);
    if (!rest.length) router.refresh();
  };

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setCanClose(false);
    try {
      const res = await Promise.race([
        markNewsRead([n.id]),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
      ]);
      if (res?.error) throw new Error(res.error);
      next();
    } catch {
      setBusy(false);
      setFailed(true);
      timer.current = setTimeout(() => setCanClose(true), 5000);
    }
  };

  const closeAnyway = () => {
    addSkipped(n.id);
    next();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/75 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={n.title}
    >
      <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-dark-600 bg-dark-800 shadow-2xl">
        <div className="overflow-y-auto px-6 pt-6">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-acid-400/10 text-acid-400">
              <Icon name="megaphone" className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-acid-400">
                Важная новость{queue.length > 1 ? ` · ещё ${queue.length - 1}` : ""}
              </p>
              <h2 className="font-display text-lg font-bold leading-tight break-words">{n.title}</h2>
            </div>
          </div>
          <NewsText text={n.body} className="mt-4 text-sm text-gray-300 leading-relaxed" />
        </div>
        <div className="px-6 pt-4 pb-6 space-y-2">
          {failed && (
            <p className="text-sm text-red-400">Не получилось сохранить отметку. Проверь интернет и попробуй ещё раз.</p>
          )}
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="w-full rounded-2xl bg-acid-400 text-black font-bold py-3.5 disabled:opacity-60"
          >
            {busy ? "Сохраняем..." : "Прочитал(а)"}
          </button>
          {canClose && (
            <button
              type="button"
              onClick={closeAnyway}
              className="w-full rounded-2xl border border-dark-600 text-gray-300 py-3"
            >
              Закрыть
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
