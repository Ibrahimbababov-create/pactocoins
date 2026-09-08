"use client";

import { useState, useTransition } from "react";
import {
  setMyOnboardingBlock,
  resetMyOnboardingBlock,
  addMyOnboardingLink,
  removeMyOnboardingLink,
} from "@/app/mop/actions";
import { ONBOARDING_DAYS, BLOCK_KIND } from "@/lib/onboardingDays";

function ArticleForm({ block }) {
  const [pending, start] = useTransition();
  const hasOwn = !!block.rop;
  const cur = block.rop ?? {};
  const [source, setSource] = useState(cur.source === "telegraph" ? "telegraph" : "text");
  const [tg, setTg] = useState(cur.telegraph_url ?? "");
  const [md, setMd] = useState(cur.body_md ?? "");
  const [msg, setMsg] = useState(null);

  function save() {
    setMsg(null);
    start(async () => {
      const res = await setMyOnboardingBlock(block.id, {
        source,
        telegraph_url: tg,
        body_md: md,
      });
      setMsg(res?.error ? res.error : "Сохранено");
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        {hasOwn
          ? "У тебя своя версия этого блока."
          : "Сейчас показывается общий дефолт. Заполни, чтобы подстроить под свой проект."}
      </p>
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
          rows={9}
          placeholder={block.defaultBody || "# Заголовок\nТекст…"}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-xs font-mono"
        />
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm"
        >
          Сохранить
        </button>
        {hasOwn && (
          <button
            onClick={() => start(() => resetMyOnboardingBlock(block.id))}
            disabled={pending}
            className="bg-dark-700 text-gray-400 rounded-lg px-3 py-2 text-sm"
          >
            Сбросить к дефолту
          </button>
        )}
        {msg && <span className="text-xs text-acid-400">{msg}</span>}
      </div>
      {source === "text" && !md && block.defaultBody && (
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer">Показать текущий дефолт</summary>
          <pre className="whitespace-pre-wrap mt-1 text-gray-400">{block.defaultBody}</pre>
        </details>
      )}
    </div>
  );
}

function LinksForm({ block }) {
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState(null);

  function add() {
    setMsg(null);
    start(async () => {
      const res = await addMyOnboardingLink(block.id, { title, url, note });
      if (res?.error) setMsg(res.error);
      else {
        setTitle("");
        setUrl("");
        setNote("");
      }
    });
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
            onClick={() => start(() => removeMyOnboardingLink(l.id))}
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
      <button
        onClick={add}
        disabled={pending}
        className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm"
      >
        + Добавить ссылку
      </button>
      {msg && <p className="text-xs text-red-400">{msg}</p>}
    </div>
  );
}

export default function OnboardingRopEditor({ blocks }) {
  const [open, setOpen] = useState(null);
  const filled = blocks.filter((b) =>
    b.kind === "links" ? b.links.length > 0 : !!b.rop
  ).length;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-400">
        Заполнено {filled} из {blocks.length}. Пустые блоки стажёр видит с пометкой
        «РОП ещё не добавил» и они пока не блокируют переход.
      </p>

      {ONBOARDING_DAYS.map((d) => {
        const list = blocks.filter((b) => b.day === d.day);
        if (!list.length) return null;
        return (
          <div key={d.day} className="space-y-2">
            <p className="text-sm font-bold text-gray-300">
              День {d.day} · {d.title}
            </p>
            {list.map((b) => {
              const ok = b.kind === "links" ? b.links.length > 0 : !!b.rop;
              return (
                <div key={b.id} className="bg-dark-800 border border-dark-600 rounded-xl">
                  <button
                    onClick={() => setOpen(open === b.id ? null : b.id)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="text-sm font-semibold">
                        {ok ? "✅" : "⬜"} {BLOCK_KIND[b.kind]?.icon} {b.title}
                      </span>
                      {b.subtitle && (
                        <span className="block text-xs text-gray-500">{b.subtitle}</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500 shrink-0">
                      {open === b.id ? "Свернуть" : "Изменить"}
                    </span>
                  </button>
                  {open === b.id && (
                    <div className="px-4 pb-4">
                      {b.kind === "article" ? (
                        <ArticleForm block={b} />
                      ) : (
                        <LinksForm block={b} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
