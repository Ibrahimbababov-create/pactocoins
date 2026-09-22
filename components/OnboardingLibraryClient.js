"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { openExternal } from "@/lib/openExternal";

// Просто читалка — без «Я изучил», без гейтинга. Для тех, кто уже
// закончил стажировку и просто хочет перечитать материал.
function Reader({ block, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-dark-900 flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-dark-600 shrink-0">
        <span className="text-sm text-gray-400 truncate">{block.title}</span>
        <button
          onClick={onClose}
          className="shrink-0 text-sm font-semibold text-acid-400 px-3 py-1.5 -mr-2 rounded-lg"
        >
          Закрыть ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-black mb-4">{block.title}</h1>
          <div className="ob-article" dangerouslySetInnerHTML={{ __html: block.html }} />
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function OnboardingLibraryClient({ blocks }) {
  const [readerBlock, setReaderBlock] = useState(null);
  const [openLinksId, setOpenLinksId] = useState(null);

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Пока пусто — админ и твой РОП ещё не добавили материалы.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {blocks.map((b) => {
        const isLinks = b.kind === "links";
        const isOpen = openLinksId === b.id;
        return (
          <div
            key={b.id}
            className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden"
          >
            <button
              onClick={() =>
                isLinks
                  ? setOpenLinksId(isOpen ? null : b.id)
                  : setReaderBlock(b)
              }
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-dark-700/60"
            >
              <span className="min-w-0">
                <span className="text-sm font-semibold">
                  {isLinks ? "🔗" : "📄"} {b.title}
                </span>
                {b.subtitle && (
                  <span className="block text-xs text-gray-500 mt-0.5">{b.subtitle}</span>
                )}
              </span>
              <span className="text-xs text-gray-500 shrink-0">
                {isLinks ? (isOpen ? "▾" : "▸") : "Читать →"}
              </span>
            </button>
            {isLinks && isOpen && (
              <div className="px-4 pb-4 space-y-2">
                {b.links.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => openExternal(l.url)}
                    className="w-full text-left rounded-lg bg-dark-900 border border-dark-600 p-3 hover:border-acid-400/40"
                  >
                    <p className="text-sm font-semibold">🔗 {l.title} ↗</p>
                    {l.note && <p className="text-xs text-gray-500 mt-0.5">{l.note}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {readerBlock && (
        <Reader block={readerBlock} onClose={() => setReaderBlock(null)} />
      )}
    </div>
  );
}
