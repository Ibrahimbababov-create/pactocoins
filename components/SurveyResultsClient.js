"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SURVEY_QUESTIONS } from "@/lib/surveyQuestions";
import { toggleSurvey } from "@/app/admin/surveyActions";

const SURVEY_URL = "https://pactocoins.vercel.app/mop/survey";
const ROLES = SURVEY_QUESTIONS.find((q) => q.id === "role").options;

const fmt = (n, d = 1) => (n == null ? "—" : n.toLocaleString("ru-RU", { maximumFractionDigits: d }));
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

// Всё считаем здесь по списку ответов: так работает и фильтр по роли.
function statsFor(q, rows) {
  const vals = rows.map((r) => r.answers?.[q.id]).filter((v) => v !== undefined && v !== null && v !== "");
  const n = vals.length;
  if (q.type === "single" || q.type === "multi") {
    const counts = Object.fromEntries(q.options.map((o) => [o, 0]));
    for (const v of vals) for (const o of Array.isArray(v) ? v : [v]) if (o in counts) counts[o] += 1;
    return { n, counts };
  }
  if (q.type === "scale" || q.type === "nps") {
    const nums = vals.filter((v) => typeof v === "number");
    const lo = q.type === "nps" ? 0 : 1;
    const hi = q.type === "nps" ? 10 : 5;
    const dist = Object.fromEntries(Array.from({ length: hi - lo + 1 }, (_, i) => [lo + i, 0]));
    for (const v of nums) dist[v] += 1;
    const nps = nums.length
      ? Math.round(((nums.filter((v) => v >= 9).length - nums.filter((v) => v <= 6).length) / nums.length) * 100)
      : null;
    return { n: nums.length, avg: avg(nums), dist, nps };
  }
  if (q.type === "grid") {
    const rowsOut = q.rows.map((r) => {
      const all = vals.map((v) => v?.[r.id]).filter((x) => typeof x === "number");
      const used = all.filter((x) => x > 0);
      return { ...r, avg: avg(used), used: used.length, skipped: all.length - used.length };
    });
    return { n, rows: rowsOut };
  }
  return { n, texts: vals.filter((v) => typeof v === "string") };
}

function reportText(rows, roleLabel) {
  const out = [`Опрос команды PactoCoins. Ответов: ${rows.length}${roleLabel ? `, только ${roleLabel}` : ""}.`, ""];
  let section = "";
  for (const q of SURVEY_QUESTIONS) {
    if (q.section !== section) {
      section = q.section;
      out.push(`## ${section}`);
    }
    const st = statsFor(q, rows);
    out.push(`${q.text} (ответили ${st.n})`);
    if (st.counts) for (const [o, c] of Object.entries(st.counts)) out.push(`  ${o}: ${c}`);
    if (st.dist) {
      out.push(`  среднее ${fmt(st.avg)}${q.type === "nps" ? `, NPS ${st.nps}` : ""}, по оценкам: ${Object.entries(st.dist).map(([k, v]) => `${k}=${v}`).join(" ")}`);
    }
    if (st.rows) for (const r of st.rows) out.push(`  ${r.label}: среднее ${fmt(r.avg)}, оценили ${r.used}, не пользуются ${r.skipped}`);
    if (st.texts) for (const t of st.texts) out.push(`  - ${t.replace(/\s+/g, " ")}`);
    out.push("");
  }
  return out.join("\n");
}

function Bar({ label, value, max, total }) {
  const w = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between gap-3 text-sm">
        <span className="min-w-0">{label}</span>
        <span className="shrink-0 tabular-nums text-gray-400">
          {value}
          {total ? ` · ${Math.round((value / total) * 100)}%` : ""}
        </span>
      </div>
      <div className="h-2 rounded-full bg-dark-700 overflow-hidden">
        <div className="h-full rounded-full bg-acid-400" style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

export default function SurveyResultsClient({ open, responses, done, staff }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [role, setRole] = useState("");
  const [copied, setCopied] = useState(null);
  const [msg, setMsg] = useState(null);

  const rows = useMemo(
    () => (role ? responses.filter((r) => r.answers?.role === role) : responses),
    [responses, role]
  );

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setMsg("Не получилось скопировать, выдели текст вручную");
    }
  };

  const flip = () =>
    start(async () => {
      setMsg(null);
      const res = await toggleSurvey(!open);
      if (res?.error) setMsg(res.error);
      router.refresh();
    });

  const nps = useMemo(() => statsFor(SURVEY_QUESTIONS.find((q) => q.type === "nps"), rows), [rows]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dark-600 bg-dark-800 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{open ? "Опрос открыт" : "Опрос закрыт"}</p>
            <p className="text-xs text-gray-500">
              {open ? "Команда видит его на главной и в «Ещё» и может пройти." : "Команда пока не видит его. Ты можешь пройти первым, по-настоящему."}
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={flip}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50 ${
              open ? "border border-dark-600 text-gray-300" : "bg-acid-400 text-black"
            }`}
          >
            {open ? "Закрыть" : "Открыть для команды"}
          </button>
        </div>
        {msg && <p className="text-xs text-red-400">{msg}</p>}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-dark-900/50 py-2">
            <p className="text-[11px] text-gray-500">Прошли</p>
            <p className="font-display font-bold tabular-nums">
              {done}
              <span className="text-gray-500 font-normal text-sm"> из {staff}</span>
            </p>
          </div>
          <div className="rounded-xl bg-dark-900/50 py-2">
            <p className="text-[11px] text-gray-500">Ответов</p>
            <p className="font-display font-bold tabular-nums">{responses.length}</p>
          </div>
          <div className="rounded-xl bg-dark-900/50 py-2">
            <p className="text-[11px] text-gray-500">Индекс NPS</p>
            <p className="font-display font-bold tabular-nums text-acid-400">{nps.nps == null ? "—" : nps.nps}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copy(SURVEY_URL, "link")}
            className="rounded-lg border border-dark-600 px-3 py-2 text-xs text-gray-300"
          >
            {copied === "link" ? "Скопировано" : "Скопировать ссылку"}
          </button>
          <Link href="/mop/survey" className="rounded-lg border border-acid-400/40 px-3 py-2 text-xs text-acid-400">
            Пройти самому
          </Link>
          <Link href="/mop/survey?preview=1" className="rounded-lg border border-dark-600 px-3 py-2 text-xs text-gray-300">
            Посмотреть понарошку
          </Link>
          <Link href="/admin/broadcast" className="rounded-lg border border-dark-600 px-3 py-2 text-xs text-gray-300">
            Разослать с кнопкой «Пройти опрос»
          </Link>
        </div>
      </div>

      {responses.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">Ответов пока нет.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {["", ...ROLES].map((r) => (
              <button
                key={r || "all"}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-full px-3 py-1.5 text-xs border ${
                  role === r ? "bg-acid-400/15 border-acid-400/40 text-acid-400" : "border-dark-600 text-gray-400"
                }`}
              >
                {r || "Все"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => copy(reportText(rows, role), "report")}
            className="w-full rounded-xl bg-acid-400 text-black font-bold py-3 text-sm"
          >
            {copied === "report" ? "Скопировано, вставь мне в чат" : "Скопировать всё для разбора"}
          </button>

          {SURVEY_QUESTIONS.map((q) => {
            const st = statsFor(q, rows);
            const max = st.counts ? Math.max(1, ...Object.values(st.counts)) : 1;
            return (
              <div key={q.id} className="rounded-2xl border border-dark-600 bg-dark-800 p-4 space-y-3">
                <div>
                  <p className="text-[11px] text-gray-500">{q.section}</p>
                  <p className="font-semibold leading-snug">{q.text}</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">ответили {st.n}</p>
                </div>

                {st.counts &&
                  Object.entries(st.counts).map(([o, c]) => <Bar key={o} label={o} value={c} max={max} total={st.n} />)}

                {st.dist && (
                  <>
                    <p className="text-2xl font-display font-bold text-acid-400 tabular-nums">
                      {fmt(st.avg)}
                      <span className="text-sm text-gray-500 font-normal">
                        {q.type === "nps" ? " из 10" : " из 5"}
                        {q.type === "nps" && st.nps != null ? ` · NPS ${st.nps}` : ""}
                      </span>
                    </p>
                    {Object.entries(st.dist).map(([k, v]) => (
                      <Bar key={k} label={k} value={v} max={Math.max(1, ...Object.values(st.dist))} total={st.n} />
                    ))}
                  </>
                )}

                {st.rows && (
                  <div className="space-y-2">
                    {st.rows.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                        <span>{r.label}</span>
                        <span className="shrink-0 tabular-nums">
                          <b className="text-acid-400">{fmt(r.avg)}</b>
                          <span className="text-gray-500 text-xs"> · не пользуются {r.skipped}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {st.texts && (
                  <div className="space-y-2">
                    {st.texts.length === 0 && <p className="text-sm text-gray-600">Пусто.</p>}
                    {st.texts.map((t, i) => (
                      <p key={i} className="rounded-xl bg-dark-900/50 px-3 py-2 text-sm text-gray-300 whitespace-pre-line">
                        {t}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
