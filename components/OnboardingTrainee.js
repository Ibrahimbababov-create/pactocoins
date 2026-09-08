"use client";

import { useState, useTransition } from "react";
import { markOnboardingBlockDone } from "@/app/mop/actions";
import { openExternal } from "@/lib/openExternal";
import { BLOCK_KIND } from "@/lib/onboardingDays";

function StatusDot({ block }) {
  if (block.done)
    return (
      <span className="w-6 h-6 shrink-0 rounded-full bg-acid-400 text-black text-xs font-bold flex items-center justify-center">
        ✓
      </span>
    );
  if (block.locked)
    return (
      <span className="w-6 h-6 shrink-0 rounded-full border border-dark-600 text-gray-600 text-xs flex items-center justify-center">
        🔒
      </span>
    );
  return (
    <span className="w-6 h-6 shrink-0 rounded-full border border-acid-400/50 text-acid-400 text-[11px] flex items-center justify-center">
      {BLOCK_KIND[block.kind]?.icon ?? "•"}
    </span>
  );
}

function Reader({ block, onClose, onDone, pending }) {
  return (
    <div className="fixed inset-0 z-[70] bg-dark-900 flex flex-col">
      <div className="flex items-center justify-between px-4 h-12 border-b border-dark-600 shrink-0">
        <span className="text-sm text-gray-400 truncate">{block.title}</span>
        <button onClick={onClose} className="text-gray-500 text-sm px-2">
          Закрыть
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-black mb-4">{block.title}</h1>
          <div
            className="ob-article"
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        </div>
      </div>
      <div className="shrink-0 border-t border-dark-600 p-3">
        <button
          onClick={onDone}
          disabled={pending || block.done}
          className={`w-full rounded-xl py-3 text-sm font-bold ${
            block.done
              ? "bg-acid-400/10 text-acid-400"
              : "bg-acid-400 text-black"
          }`}
        >
          {block.done ? "✓ Изучено" : "✓ Я изучил"}
        </button>
      </div>
    </div>
  );
}

function LinksBlock({ block, onDone, pending }) {
  return (
    <div className="mt-2 space-y-2">
      {block.links.length === 0 && (
        <p className="text-xs text-gray-500">
          Твой РОП скоро добавит материалы сюда.
        </p>
      )}
      {block.links.map((l) => (
        <button
          key={l.id}
          onClick={() => openExternal(l.url)}
          className="w-full text-left rounded-xl bg-dark-800 border border-dark-600 p-3 hover:border-acid-400/40"
        >
          <p className="text-sm font-semibold">🔗 {l.title} ↗</p>
          {l.note && <p className="text-xs text-gray-500 mt-0.5">{l.note}</p>}
        </button>
      ))}
      {block.links.length > 0 && !block.done && (
        <button
          onClick={onDone}
          disabled={pending}
          className="w-full rounded-xl bg-acid-400 text-black py-2.5 text-sm font-bold"
        >
          ✓ Готово, всё открыл
        </button>
      )}
    </div>
  );
}

export default function OnboardingTrainee({ days, ropName }) {
  const [isPending, start] = useTransition();
  const [openDay, setOpenDay] = useState(
    days.find((d) => !d.locked && !d.complete)?.day ?? 1
  );
  const [reader, setReader] = useState(null);
  const [expanded, setExpanded] = useState(null);

  function done(blockId) {
    start(async () => {
      await markOnboardingBlockDone(blockId);
      setReader(null);
    });
  }

  const totalDays = days.filter((d) => d.complete).length;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-sky-500/10 to-dark-800 border border-sky-500/30 rounded-2xl p-5 space-y-2">
        <p className="text-lg font-bold text-sky-300">🎓 Обучение стажёра</p>
        <p className="text-sm text-gray-400">
          Три дня. Каждый блок нужно пройти по порядку — следующий откроется
          только после предыдущего. День закрыт, пока не пройден предыдущий.
        </p>
        <p className="text-sm text-gray-400">
          Стажировка закрывается автоматически после{" "}
          <b className="text-white">первой одобренной оплаты</b> — тогда ты
          становишься МОПом 1 уровня.
        </p>
        <p className="text-xs text-gray-500 pt-1">
          {ropName
            ? `Твой руководитель: ${ropName}`
            : "Руководитель не выбран — выбери его в Настройках."}{" "}
          · Пройдено дней: {totalDays}/3
        </p>
      </div>

      {days.map((d) => (
        <div key={d.day} className="rounded-2xl border border-dark-600 overflow-hidden">
          <button
            onClick={() => !d.locked && setOpenDay(openDay === d.day ? null : d.day)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-dark-800 text-left"
          >
            <span
              className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                d.complete
                  ? "bg-acid-400 text-black"
                  : d.locked
                  ? "border border-dark-600 text-gray-600"
                  : "border border-gray-600 text-gray-400"
              }`}
            >
              {d.complete ? "✓" : d.locked ? "🔒" : d.day}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-sm">
                День {d.day} · {d.title}
              </span>
              <span className="block text-xs text-gray-500">
                {d.locked ? `Сначала пройди День ${d.day - 1}` : d.subtitle}
              </span>
            </span>
            {!d.locked && (
              <span className="text-xs text-gray-500 shrink-0">
                {d.doneCount}/{d.totalCount}
              </span>
            )}
          </button>

          {openDay === d.day && !d.locked && (
            <div className="p-3 space-y-2 bg-dark-900/40">
              {d.blocks.map((b) => {
                const active = !b.locked && !b.done;
                return (
                  <div
                    key={b.id}
                    className={`rounded-xl border p-3 ${
                      b.locked
                        ? "border-dark-700 opacity-50"
                        : "border-dark-600 bg-dark-800"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <StatusDot block={b} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{b.title}</p>
                        {b.subtitle && (
                          <p className="text-xs text-gray-500 mt-0.5">{b.subtitle}</p>
                        )}

                        {b.kind === "test" && (
                          <p className="text-xs text-gray-500 mt-1">
                            Тест скоро появится.
                          </p>
                        )}
                        {b.owner === "rop" && !b.hasContent && b.kind !== "test" && (
                          <p className="text-xs text-gray-500 mt-1">
                            Твой РОП ещё не добавил материал.
                          </p>
                        )}

                        {!b.locked && b.kind === "article" && b.html && (
                          <button
                            onClick={() => setReader(b)}
                            className="mt-2 text-xs font-bold bg-dark-700 rounded-lg px-3 py-1.5"
                          >
                            {b.done ? "Открыть ещё раз" : "Открыть →"}
                          </button>
                        )}
                        {!b.locked && b.kind === "links" && (
                          <button
                            onClick={() =>
                              setExpanded(expanded === b.id ? null : b.id)
                            }
                            className="mt-2 text-xs font-bold bg-dark-700 rounded-lg px-3 py-1.5"
                          >
                            {expanded === b.id ? "Свернуть" : "Открыть →"}
                          </button>
                        )}
                        {!b.locked && b.kind === "links" && expanded === b.id && (
                          <LinksBlock
                            block={b}
                            onDone={() => done(b.id)}
                            pending={isPending}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {reader && (
        <Reader
          block={reader}
          onClose={() => setReader(null)}
          onDone={() => done(reader.id)}
          pending={isPending}
        />
      )}
    </div>
  );
}
