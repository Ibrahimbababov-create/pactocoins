"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import AnimatedNumber from "@/components/AnimatedNumber";
import { chipsNom } from "@/lib/plural";
import {
  SURVEY_QUESTIONS,
  SURVEY_REWARD_CHIPS,
  SURVEY_MINUTES,
  SURVEY_ID,
  TEXT_MAX,
  answerOk,
} from "@/lib/surveyQuestions";
import { submitSurvey } from "@/app/mop/survey/actions";

const DRAFT_KEY = `survey-${SURVEY_ID}`;
const TOTAL = SURVEY_QUESTIONS.length;

// Опрос по одному вопросу на экран: крупные кнопки, ответ на выбор
// переключает дальше сам, черновик живёт в телефоне, пока не отправишь.
export default function SurveyClient({ preview = false }) {
  const [phase, setPhase] = useState("intro"); // intro | q | done
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});
  const [resumeAt, setResumeAt] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [pending, start] = useTransition();
  const timer = useRef(null);

  // Вернулся в опрос — продолжаем с того же места.
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (d?.answers && typeof d.answers === "object") {
        setAnswers(d.answers);
        if (Number.isInteger(d.i) && d.i > 0 && d.i < TOTAL) {
          setResumeAt(d.i);
          setI(d.i);
        }
      }
    } catch {}
    return () => clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (phase !== "q") return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ i, answers }));
    } catch {}
  }, [phase, i, answers]);

  const q = SURVEY_QUESTIONS[i];
  const value = answers[q.id];
  const ok = answerOk(q, value);
  const last = i === TOTAL - 1;
  // Необязательный текст без ответа можно пропустить.
  const canNext = ok || (q.type === "text" && !q.required);

  const set = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));
  // Правки по предыдущему ответу считаем от свежего состояния, а не от
  // того, что было на экране: два быстрых нажатия подряд не затрут друг друга.
  const update = (id, fn) => setAnswers((a) => ({ ...a, [id]: fn(a[id]) }));

  // Ответ нажатием: записываем и через мгновение листаем дальше.
  const pick = (v) => {
    set(q.id, v);
    if (last) return;
    clearTimeout(timer.current);
    const at = i;
    timer.current = setTimeout(() => setI((n) => (n === at ? n + 1 : n)), 260);
  };

  const go = (d) => {
    clearTimeout(timer.current);
    setError(null);
    setI((n) => Math.max(0, Math.min(TOTAL - 1, n + d)));
  };

  const send = () =>
    start(async () => {
      setError(null);
      const res = preview ? { ok: true, preview: true } : await submitSurvey(answers);
      if (res?.error) return setError(res.error);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setResult(res);
      setPhase("done");
    });

  if (phase === "intro") {
    return (
      <div className="space-y-4">
        {preview && <PreviewNote />}
        <div className="rounded-2xl border border-acid-400/30 bg-gradient-to-br from-acid-400/15 to-dark-800 p-5">
          <p className="text-xs font-semibold text-acid-400">Опрос команды</p>
          <h2 className="mt-1 text-2xl font-display font-bold leading-tight">Помоги сделать PactoCoins лучше</h2>
          <p className="mt-3 text-sm text-gray-300 leading-relaxed">
            {TOTAL} вопросов, примерно {SURVEY_MINUTES} минуты. Что работает, что бесит, чего не хватает. Всё, что
            напишешь, реально влияет на то, что мы будем менять.
          </p>
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-dark-900/50 px-4 py-3">
            <Icon name="gift" className="w-6 h-6 shrink-0 text-acid-400" />
            <p className="text-sm">
              За ответы <b className="text-acid-400">+{SURVEY_REWARD_CHIPS} {chipsNom(SURVEY_REWARD_CHIPS)}</b> на
              колесо фортуны
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-dark-600 bg-dark-800 p-4">
          <Icon name="lock" className="w-5 h-5 shrink-0 text-gray-400 mt-0.5" />
          <p className="text-sm text-gray-400 leading-relaxed">
            Анонимно. Ответы сохраняются без твоего имени. Мы только запоминаем, что ты прошёл опрос, чтобы
            начислить фишки один раз. Пиши честно, как есть.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setI(resumeAt);
            setPhase("q");
          }}
          className="w-full bg-acid-400 text-black font-bold rounded-xl py-3.5"
        >
          {resumeAt > 0 ? `Продолжить с вопроса ${resumeAt + 1}` : "Начать"}
        </button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-4 pt-4 text-center">
        <span className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-acid-400/15 text-acid-400">
          <Icon name="check" className="w-8 h-8" strokeWidth={2.5} />
        </span>
        <h2 className="text-2xl font-display font-bold">Спасибо!</h2>
        {result?.preview ? (
          <p className="text-sm text-gray-400">
            Так выглядит конец опроса. В режиме просмотра ничего не сохранено и фишки не начислены.
          </p>
        ) : result?.rewarded === false ? (
          <p className="text-sm text-gray-400">
            Ответы сохранены. Фишки не дошли, мы начислим их вручную, ничего повторять не нужно.
          </p>
        ) : (
          <>
            <p className="text-5xl font-display font-bold text-acid-400 tabular-nums">
              +<AnimatedNumber value={result?.chips ?? SURVEY_REWARD_CHIPS} />
            </p>
            <p className="text-sm text-gray-400">
              {chipsNom(result?.chips ?? SURVEY_REWARD_CHIPS)} уже у тебя. Крути колесо.
            </p>
          </>
        )}
        <Link
          href="/mop/games/wheel"
          className="block w-full bg-acid-400 text-black font-bold rounded-xl py-3.5"
        >
          К колесу фортуны
        </Link>
        <Link href="/mop/more" className="block text-sm text-gray-500 underline py-2">
          Назад в «Ещё»
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {preview && <PreviewNote />}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{q.section}</span>
          <span className="tabular-nums">
            {i + 1} из {TOTAL}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-dark-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-acid-400 transition-all duration-300"
            style={{ width: `${((i + 1) / TOTAL) * 100}%` }}
          />
        </div>
      </div>

      <style>{`
        @keyframes survey-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .survey-in { animation: survey-in .28s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .survey-in { animation: none; } }
      `}</style>

      <div key={q.id} className="survey-in space-y-4">
        <div>
          <h2 className="text-xl font-display font-bold leading-snug">{q.text}</h2>
          {q.hint && <p className="mt-1.5 text-sm text-gray-500">{q.hint}</p>}
        </div>

        {q.type === "single" && (
          <div className="space-y-2">
            {q.options.map((o) => (
              <Choice key={o} active={value === o} onClick={() => pick(o)}>
                {o}
              </Choice>
            ))}
          </div>
        )}

        {q.type === "multi" && (
          <div className="space-y-2">
            {q.options.map((o) => {
              const picked = Array.isArray(value) && value.includes(o);
              const full = Array.isArray(value) && value.length >= q.max && !picked;
              return (
                <Choice
                  key={o}
                  active={picked}
                  square
                  disabled={full}
                  onClick={() =>
                    update(q.id, (v) => {
                      const cur = Array.isArray(v) ? v : [];
                      if (cur.includes(o)) return cur.filter((x) => x !== o);
                      return cur.length >= q.max ? cur : [...cur, o];
                    })
                  }
                >
                  {o}
                </Choice>
              );
            })}
          </div>
        )}

        {q.type === "scale" && (
          <ScaleRow
            values={[1, 2, 3, 4, 5]}
            cols="grid-cols-5"
            value={value}
            onPick={pick}
            low={q.low}
            high={q.high}
          />
        )}

        {q.type === "nps" && (
          <ScaleRow
            values={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
            cols="grid-cols-6"
            value={value}
            onPick={pick}
            low={q.low}
            high={q.high}
          />
        )}

        {q.type === "grid" && (
          <div className="space-y-3">
            {q.rows.map((r) => {
              const v = value?.[r.id];
              return (
                <div key={r.id} className="rounded-xl border border-dark-600 bg-dark-800 p-3">
                  <p className="text-sm font-semibold">{r.label}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => update(q.id, (v) => ({ ...(v ?? {}), [r.id]: n }))}
                        className={`flex-1 h-10 rounded-lg border text-sm font-bold tabular-nums transition ${
                          v === n
                            ? "bg-acid-400 border-acid-400 text-black"
                            : "border-dark-600 text-gray-300 active:bg-dark-700"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => update(q.id, (v) => ({ ...(v ?? {}), [r.id]: 0 }))}
                      className={`shrink-0 h-10 px-2.5 rounded-lg border text-[11px] leading-tight transition ${
                        v === 0
                          ? "bg-dark-600 border-gray-500 text-white"
                          : "border-dark-600 text-gray-500 active:bg-dark-700"
                      }`}
                    >
                      не
                      <br />
                      польз.
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {q.type === "text" && (
          <div>
            <textarea
              value={typeof value === "string" ? value : ""}
              onChange={(e) => set(q.id, e.target.value.slice(0, TEXT_MAX))}
              rows={5}
              placeholder={q.placeholder}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-acid-400"
            />
            <p className="mt-1 text-right text-[11px] text-gray-600 tabular-nums">
              {(value ?? "").length}/{TEXT_MAX}
            </p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => (i === 0 ? setPhase("intro") : go(-1))}
          className="shrink-0 rounded-xl border border-dark-600 px-4 py-3 text-sm text-gray-300 active:bg-dark-700"
        >
          Назад
        </button>
        {last ? (
          <button
            type="button"
            disabled={!canNext || pending}
            onClick={send}
            className="flex-1 bg-acid-400 text-black font-bold rounded-xl py-3 disabled:opacity-40"
          >
            {pending ? "Отправляем…" : "Отправить"}
          </button>
        ) : (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => go(1)}
            className="flex-1 bg-acid-400 text-black font-bold rounded-xl py-3 disabled:opacity-40"
          >
            {q.type === "text" && !q.required && !ok ? "Пропустить" : "Дальше"}
          </button>
        )}
      </div>
    </div>
  );
}

function PreviewNote() {
  return (
    <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-2.5 text-xs text-amber-300">
      Режим просмотра: можно пройти до конца, но ничего не сохранится и фишки не начислятся.
    </p>
  );
}

function Choice({ active, square = false, disabled = false, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[15px] transition disabled:opacity-40 ${
        active ? "border-acid-400 bg-acid-400/10 text-white" : "border-dark-600 bg-dark-800 text-gray-300 active:bg-dark-700"
      }`}
    >
      <span
        className={`flex items-center justify-center w-5 h-5 shrink-0 border ${square ? "rounded-md" : "rounded-full"} ${
          active ? "border-acid-400 bg-acid-400" : "border-dark-500"
        }`}
      >
        {active && <Icon name="check" className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

function ScaleRow({ values, cols, value, onPick, low, high }) {
  return (
    <div className="space-y-2">
      <div className={`grid ${cols} gap-2`}>
        {values.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className={`h-14 rounded-xl border text-lg font-display font-bold tabular-nums transition ${
              value === n
                ? "bg-acid-400 border-acid-400 text-black"
                : "border-dark-600 bg-dark-800 text-gray-300 active:bg-dark-700"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}
