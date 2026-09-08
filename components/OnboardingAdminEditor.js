"use client";

import { useState, useTransition } from "react";
import {
  setAdminOnboardingBlock,
  addAdminOnboardingLink,
  removeAdminOnboardingLink,
  upsertOnboardingQuestion,
  deleteOnboardingQuestion,
} from "@/app/admin/actions";
import { uploadOnboardingFile } from "@/lib/uploadOnboardingFile";
import { ONBOARDING_DAYS, BLOCK_KIND, BLOCK_OWNER } from "@/lib/onboardingDays";

// Кнопка загрузки фото/PDF (до 20 МБ) прямо в блок «Ссылки».
function FileUploadButton({ uploading, onPick }) {
  return (
    <label
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold cursor-pointer ${
        uploading ? "bg-dark-700 text-gray-500" : "bg-dark-700 text-gray-200"
      }`}
    >
      {uploading ? "Загрузка…" : "📎 Загрузить файл"}
      <input
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPick(f);
        }}
      />
    </label>
  );
}

function ArticleForm({ block, onSaved }) {
  const [pending, start] = useTransition();
  const [source, setSource] = useState(block.source === "telegraph" ? "telegraph" : "text");
  const [tg, setTg] = useState(block.telegraph_url ?? "");
  const [md, setMd] = useState(block.body_md ?? "");
  const [msg, setMsg] = useState(null);

  function save() {
    setMsg(null);
    start(async () => {
      const res = await setAdminOnboardingBlock(block.id, {
        source,
        telegraph_url: tg,
        body_md: md,
      });
      setMsg(res?.error ? res.error : "Сохранено");
      if (!res?.error) onSaved?.();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={source === "text"} onChange={() => setSource("text")} />
          Текст
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={source === "telegraph"}
            onChange={() => setSource("telegraph")}
          />
          telegra.ph
        </label>
      </div>
      {source === "telegraph" ? (
        <input
          value={tg}
          onChange={(e) => setTg(e.target.value)}
          placeholder="https://telegra.ph/..."
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        />
      ) : (
        <textarea
          value={md}
          onChange={(e) => setMd(e.target.value)}
          rows={10}
          placeholder="# Заголовок&#10;Текст. **жирный**, _курсив_, __подчёркнуто__&#10;- список"
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-xs font-mono"
        />
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm"
        >
          Сохранить
        </button>
        {msg && <span className="text-xs text-acid-400">{msg}</span>}
      </div>
    </div>
  );
}

function LinksForm({ block }) {
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState(null);
  const [uploading, setUploading] = useState(false);

  function add() {
    setMsg(null);
    start(async () => {
      const res = await addAdminOnboardingLink(block.id, { title, url, note });
      if (res?.error) setMsg(res.error);
      else {
        setTitle("");
        setUrl("");
        setNote("");
      }
    });
  }

  async function handleFile(file) {
    setMsg(null);
    setUploading(true);
    const up = await uploadOnboardingFile(file);
    if (up.error) {
      setMsg(up.error);
      setUploading(false);
      return;
    }
    const res = await addAdminOnboardingLink(block.id, {
      title: up.name,
      url: up.url,
      note: "",
    });
    if (res?.error) setMsg(res.error);
    setUploading(false);
  }

  return (
    <div className="space-y-2">
      {block.links.map((l) => (
        <div
          key={l.id}
          className="flex items-center justify-between gap-2 bg-dark-700 rounded-lg px-3 py-2"
        >
          <span className="text-xs truncate">
            🔗 {l.title}
            {l.note ? ` · ${l.note}` : ""}
          </span>
          <button
            onClick={() => start(() => removeAdminOnboardingLink(l.id))}
            disabled={pending}
            className="text-xs text-red-400 shrink-0"
          >
            Удалить
          </button>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название"
          className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Ссылка"
          className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        />
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Примечание (необязательно)"
        className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={add}
          disabled={pending || uploading}
          className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm"
        >
          + Добавить ссылку
        </button>
        <FileUploadButton uploading={uploading} onPick={handleFile} />
        <span className="text-xs text-gray-600">фото или PDF, до 20 МБ</span>
      </div>
      {msg && <p className="text-xs text-red-400">{msg}</p>}
    </div>
  );
}

function QuestionForm({ day, initial, onDone }) {
  const [pending, start] = useTransition();
  const [q, setQ] = useState(initial?.question ?? "");
  const [opts, setOpts] = useState(
    initial?.options?.length ? [...initial.options] : ["", "", "", ""]
  );
  const [correct, setCorrect] = useState(initial?.correct ?? 0);
  const [msg, setMsg] = useState(null);

  function save() {
    setMsg(null);
    start(async () => {
      const res = await upsertOnboardingQuestion(day, {
        id: initial?.id,
        question: q,
        options: opts,
        correct,
      });
      if (res?.error) setMsg(res.error);
      else {
        if (!initial) {
          setQ("");
          setOpts(["", "", "", ""]);
          setCorrect(0);
        }
        onDone?.();
      }
    });
  }

  return (
    <div className="space-y-2 bg-dark-900/50 border border-dark-600 rounded-lg p-3">
      <textarea
        value={q}
        onChange={(e) => setQ(e.target.value)}
        rows={2}
        placeholder="Вопрос"
        className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
      />
      {opts.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="radio"
            name={`c-${initial?.id ?? "new"}-${day}`}
            checked={correct === i}
            onChange={() => setCorrect(i)}
            title="Правильный ответ"
          />
          <input
            value={o}
            onChange={(e) =>
              setOpts((p) => p.map((x, j) => (j === i ? e.target.value : x)))
            }
            placeholder={`Вариант ${i + 1}`}
            className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-white text-sm"
          />
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="bg-acid-400 text-black font-bold rounded-lg px-4 py-1.5 text-sm"
        >
          {initial ? "Сохранить" : "Добавить вопрос"}
        </button>
        {initial && (
          <button
            onClick={() => start(() => deleteOnboardingQuestion(initial.id).then(onDone))}
            disabled={pending}
            className="text-xs text-red-400"
          >
            Удалить
          </button>
        )}
        {msg && <span className="text-xs text-red-400">{msg}</span>}
      </div>
    </div>
  );
}

function QuestionEditor({ block }) {
  const [editing, setEditing] = useState(null);
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        Проходной 80%, попыток без ограничений. Вопросов: {block.questions.length}
      </p>
      {block.questions.map((qq, i) =>
        editing === qq.id ? (
          <QuestionForm
            key={qq.id}
            day={block.day}
            initial={qq}
            onDone={() => setEditing(null)}
          />
        ) : (
          <div
            key={qq.id}
            className="bg-dark-700 rounded-lg px-3 py-2 flex items-start justify-between gap-2"
          >
            <span className="text-xs">
              <b>{i + 1}.</b> {qq.question}
              <span className="block text-gray-500 mt-0.5">
                ✓ {qq.options[qq.correct]}
              </span>
            </span>
            <button
              onClick={() => setEditing(qq.id)}
              className="text-xs text-gray-400 shrink-0"
            >
              Изменить
            </button>
          </div>
        )
      )}
      <QuestionForm day={block.day} onDone={() => {}} />
    </div>
  );
}

export default function OnboardingAdminEditor({ blocks }) {
  const [open, setOpen] = useState(null);

  return (
    <div className="space-y-6">
      {ONBOARDING_DAYS.map((d) => (
        <div key={d.day} className="space-y-2">
          <p className="text-sm font-bold text-gray-300">
            День {d.day} · {d.title}
          </p>
          {blocks
            .filter((b) => b.day === d.day)
            .map((b) => {
              const editable =
                b.kind === "article" ||
                (b.kind === "links" && b.owner === "admin") ||
                b.kind === "test";
              return (
                <div key={b.id} className="bg-dark-800 border border-dark-600 rounded-xl">
                  <button
                    onClick={() => setOpen(open === b.id ? null : b.id)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="text-sm font-semibold">
                        {BLOCK_KIND[b.kind]?.icon} {b.title}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {BLOCK_OWNER[b.owner]}
                        {b.kind === "article" &&
                          ` · ${b.source === "telegraph" ? "telegra.ph" : b.body_md ? "текст" : "пусто"}`}
                        {b.kind === "links" && ` · ссылок: ${b.links.length}`}
                        {b.kind === "test" && ` · вопросов: ${b.questions.length}`}
                      </span>
                    </span>
                    {editable && (
                      <span className="text-xs text-gray-500 shrink-0">
                        {open === b.id ? "Свернуть" : "Изменить"}
                      </span>
                    )}
                  </button>
                  {open === b.id && editable && (
                    <div className="px-4 pb-4">
                      {b.owner === "rop" && (
                        <p className="text-xs text-gray-500 mb-2">
                          Это общий дефолт. Каждый РОП может переопределить его у себя.
                        </p>
                      )}
                      {b.kind === "article" && (
                        <ArticleForm block={b} onSaved={() => {}} />
                      )}
                      {b.kind === "links" && <LinksForm block={b} />}
                      {b.kind === "test" && <QuestionEditor block={b} />}
                    </div>
                  )}
                  {b.kind === "links" && b.owner === "rop" && (
                    <p className="px-4 pb-3 text-xs text-gray-500">
                      Ссылки заполняет РОП на своей странице.
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}
