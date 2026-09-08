"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { markOnboardingBlockDone, submitOnboardingTest } from "@/app/mop/actions";
import { openExternal } from "@/lib/openExternal";
import { BLOCK_KIND } from "@/lib/onboardingDays";

// Пересчитываем гейтинг на клиенте, чтобы отметка «изучил» срабатывала
// мгновенно, не дожидаясь ответа сервера. Логика 1-в-1 с getTraineeOnboarding.
function recompute(days, doneSet) {
  const out = days.map((d) => {
    let blocked = false;
    const blocks = d.blocks.map((b) => {
      const done = b.done || doneSet.has(b.id);
      const locked = blocked;
      if (b.gates && !done) blocked = true;
      return { ...b, done, locked };
    });
    const gating = blocks.filter((b) => b.gates);
    const doneCount = gating.filter((b) => b.done).length;
    const complete = gating.length > 0 && doneCount === gating.length;
    return { ...d, blocks, doneCount, totalCount: gating.length, complete };
  });
  for (let i = 0; i < out.length; i++) {
    out[i].locked = i > 0 && !out[i - 1].complete;
  }
  return out;
}

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

function Reader({ block, onClose, onDone }) {
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
          <div
            className="ob-article"
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        </div>
      </div>
      <div
        className="shrink-0 border-t border-dark-600 p-3 flex gap-2"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={onClose}
          className="shrink-0 rounded-xl px-4 py-3 text-sm font-bold bg-dark-700 text-gray-300"
        >
          Назад
        </button>
        <button
          onClick={onDone}
          className={`flex-1 rounded-xl py-3 text-sm font-bold active:scale-[0.98] transition-transform ${
            block.done ? "bg-acid-400/10 text-acid-400" : "bg-acid-400 text-black"
          }`}
        >
          {block.done ? "✓ Изучено — закрыть" : "✓ Я изучил"}
        </button>
      </div>
    </div>,
    document.body
  );
}

function TestOverlay({ block, onClose, onPassed }) {
  const qs = block.test?.questions ?? [];
  const [answers, setAnswers] = useState(() => qs.map(() => -1));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const allAnswered = answers.every((a) => a >= 0);

  async function submit() {
    if (!allAnswered || busy) return;
    setBusy(true);
    try {
      const res = await submitOnboardingTest(block.id, block.test.day, answers);
      if (res?.error) {
        setResult({ error: res.error });
      } else {
        setResult(res);
        if (res.passed) onPassed(block.id);
      }
    } catch {
      setResult({ error: "Не отправилось — попробуй ещё раз" });
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    setAnswers(qs.map(() => -1));
    setResult(null);
  }

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
          className="shrink-0 text-sm font-semibold text-acid-400 px-3 py-1.5 -mr-2"
        >
          Закрыть ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-lg mx-auto space-y-5">
          {result && !result.error ? (
            <div className="text-center py-6">
              <p className="text-5xl mb-3">{result.passed ? "🎉" : "😔"}</p>
              <p className="text-2xl font-black">
                {result.correct} из {result.total} · {result.score}%
              </p>
              <p
                className={`mt-2 text-sm ${
                  result.passed ? "text-acid-400" : "text-gray-400"
                }`}
              >
                {result.passed
                  ? "Тест пройден!"
                  : `Нужно ${block.test.passPct}%. Разбери ошибки и попробуй снова.`}
              </p>
            </div>
          ) : (
            <>
              {result?.error && (
                <p className="text-sm text-red-400 text-center">{result.error}</p>
              )}
              {qs.map((q, i) => (
                <div key={q.id}>
                  <p className="text-sm font-semibold mb-2">
                    {i + 1}. {q.question}
                  </p>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => (
                      <button
                        key={oi}
                        onClick={() =>
                          setAnswers((a) =>
                            a.map((x, xi) => (xi === i ? oi : x))
                          )
                        }
                        className={`w-full text-left rounded-xl border px-3 py-2.5 text-sm ${
                          answers[i] === oi
                            ? "border-acid-400 bg-acid-400/10 text-white"
                            : "border-dark-600 bg-dark-800 text-gray-300"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div
        className="shrink-0 border-t border-dark-600 p-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        {result && !result.error ? (
          result.passed ? (
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-acid-400 text-black py-3 text-sm font-bold"
            >
              Готово
            </button>
          ) : (
            <button
              onClick={retry}
              className="w-full rounded-xl bg-acid-400 text-black py-3 text-sm font-bold"
            >
              Пройти заново
            </button>
          )
        ) : (
          <button
            onClick={submit}
            disabled={!allAnswered || busy}
            className="w-full rounded-xl bg-acid-400 text-black py-3 text-sm font-bold disabled:opacity-40"
          >
            {busy ? "Проверяю…" : allAnswered ? "Проверить" : "Ответь на все вопросы"}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

function LinksBlock({ block, onDone }) {
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
          className="w-full rounded-xl bg-acid-400 text-black py-2.5 text-sm font-bold active:scale-[0.98] transition-transform"
        >
          ✓ Готово, всё открыл
        </button>
      )}
      {block.done && (
        <p className="text-xs text-acid-400">✓ Пройдено</p>
      )}
    </div>
  );
}

export default function OnboardingTrainee({ days: serverDays, ropName }) {
  const [doneSet, setDoneSet] = useState(
    () =>
      new Set(
        serverDays.flatMap((d) => d.blocks).filter((b) => b.done).map((b) => b.id)
      )
  );
  const [readerId, setReaderId] = useState(null);
  const [testId, setTestId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [err, setErr] = useState(null);
  const inFlight = useRef(new Set());

  const days = useMemo(() => recompute(serverDays, doneSet), [serverDays, doneSet]);

  const [openDay, setOpenDay] = useState(
    () => days.find((d) => !d.locked && !d.complete)?.day ?? 1
  );

  const flat = days.flatMap((d) => d.blocks);
  const readerBlock = readerId ? flat.find((b) => b.id === readerId) : null;
  const testBlock = testId ? flat.find((b) => b.id === testId) : null;

  function markDone(id) {
    if (doneSet.has(id)) {
      setReaderId(null);
      setExpanded(null);
      return;
    }
    // мгновенно: локально отмечаем, разблокируем следующий блок, закрываем
    setDoneSet((s) => new Set(s).add(id));
    setReaderId(null);
    setExpanded(null);

    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    Promise.resolve(markOnboardingBlockDone(id))
      .then((res) => {
        if (res?.error) throw new Error(res.error);
      })
      .catch(() => {
        setDoneSet((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        setErr("Не сохранилось — нажми ещё раз");
        setTimeout(() => setErr(null), 3000);
      })
      .finally(() => inFlight.current.delete(id));
  }

  // тест уже сохранён на сервере в submitOnboardingTest — тут только
  // мгновенно разблокируем следующий блок / день
  function addLocalDone(id) {
    setDoneSet((s) => (s.has(id) ? s : new Set(s).add(id)));
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

      {err && (
        <div className="rounded-xl bg-red-500/10 text-red-400 text-sm px-3 py-2 text-center">
          {err}
        </div>
      )}

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
              {d.blocks.map((b) => (
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

                      {b.kind === "test" && !b.hasContent && (
                        <p className="text-xs text-gray-500 mt-1">
                          Тест ещё готовится.
                        </p>
                      )}
                      {b.kind === "test" && b.hasContent && (
                        <p className="text-xs text-gray-500 mt-1">
                          {b.test.questions.length} вопросов · проходной{" "}
                          {b.test.passPct}% · попыток без ограничений
                        </p>
                      )}
                      {b.owner === "rop" && !b.hasContent && b.kind !== "test" && (
                        <p className="text-xs text-gray-500 mt-1">
                          Твой РОП ещё не добавил материал.
                        </p>
                      )}

                      {!b.locked && b.kind === "test" && b.hasContent && (
                        <button
                          onClick={() => setTestId(b.id)}
                          className="mt-2 text-xs font-bold bg-dark-700 rounded-lg px-3 py-1.5"
                        >
                          {b.done ? "Пройти ещё раз" : "Пройти тест →"}
                        </button>
                      )}

                      {!b.locked && b.kind === "article" && b.html && (
                        <button
                          onClick={() => setReaderId(b.id)}
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
                        <LinksBlock block={b} onDone={() => markDone(b.id)} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {readerBlock && (
        <Reader
          block={readerBlock}
          onClose={() => setReaderId(null)}
          onDone={() => markDone(readerBlock.id)}
        />
      )}

      {testBlock && testBlock.test && (
        <TestOverlay
          block={testBlock}
          onClose={() => setTestId(null)}
          onPassed={addLocalDone}
        />
      )}
    </div>
  );
}
