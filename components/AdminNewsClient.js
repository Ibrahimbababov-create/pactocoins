"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import NewsText from "@/components/NewsText";
import { saveNews, setNewsPublished } from "@/app/admin/newsActions";

const TITLE_MAX = 80;
const BODY_MAX = 1000;

const EMPTY = { id: null, title: "", body: "", important: false, toGroup: false };

// Как новость увидит сотрудник
function Preview({ title, body, important }) {
  return (
    <div className="rounded-2xl border border-dark-600 bg-dark-900/60 p-4">
      <p className="text-xs text-gray-500 mb-2">Так увидит сотрудник</p>
      <div className="rounded-2xl border border-acid-400/30 bg-dark-800 p-4">
        <div className="flex items-start gap-3">
          <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-xl bg-acid-400/10 text-acid-400">
            <Icon name="megaphone" className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            {important && <p className="text-xs text-acid-400 mb-0.5">Важная новость</p>}
            <p className="font-display font-bold leading-snug break-words">{title || "Заголовок"}</p>
          </div>
        </div>
        <NewsText text={body || "Текст новости"} className="mt-3 text-sm text-gray-300 leading-relaxed" />
        {important && (
          <div className="mt-4 rounded-xl bg-acid-400 text-black font-bold text-center py-3">Прочитал(а)</div>
        )}
      </div>
    </div>
  );
}

export default function AdminNewsClient({ items, staffTotal }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: "ok" | "err", text }
  const [pending, start] = useTransition();

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const editing = form.id != null;
  const editingItem = editing ? items.find((i) => i.id === form.id) : null;
  const alreadyLive = Boolean(editingItem?.published);

  const reset = () => {
    setForm(EMPTY);
    setPreview(false);
    setConfirming(false);
  };

  const edit = (n) => {
    setForm({ id: n.id, title: n.title, body: n.body, important: n.important, toGroup: false });
    setPreview(false);
    setConfirming(false);
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = (mode) => {
    setMsg(null);
    start(async () => {
      const res = await saveNews({ ...form, mode });
      if (res?.error) {
        setMsg({ kind: "err", text: res.error });
        setConfirming(false);
        return;
      }
      const parts = [mode === "publish" ? "Новость опубликована" : "Черновик сохранён"];
      if (res.sentToGroup) parts.push("в группу отправлено");
      setMsg(
        res.groupError
          ? { kind: "err", text: `${parts[0]}, но в группу не ушло: ${res.groupError}` }
          : { kind: "ok", text: parts.join(", ") }
      );
      reset();
      router.refresh();
    });
  };

  const toggle = (n) => {
    if (!n.published && !window.confirm("Точно опубликовать? Новость увидят все сотрудники")) return;
    setMsg(null);
    start(async () => {
      const res = await setNewsPublished(n.id, !n.published);
      if (res?.error) setMsg({ kind: "err", text: res.error });
      else {
        setMsg({ kind: "ok", text: n.published ? "Новость снята с публикации" : "Новость снова опубликована" });
        router.refresh();
      }
    });
  };

  const valid = form.title.trim() && form.body.trim();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-dark-700 bg-dark-800 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{editing ? "Правка новости" : "Новая новость"}</h2>
          {editing && (
            <button type="button" onClick={reset} className="text-sm text-gray-400 underline underline-offset-2">
              Отменить правку
            </button>
          )}
        </div>

        <div>
          <label className="text-sm text-gray-400" htmlFor="news-title">
            Заголовок
          </label>
          <input
            id="news-title"
            value={form.title}
            maxLength={TITLE_MAX}
            onChange={(e) => set({ title: e.target.value })}
            className="mt-1 w-full rounded-xl border border-dark-600 bg-dark-900 px-3 py-2.5 outline-none focus:border-acid-400/60"
            placeholder="Например: В магазине появились новые награды"
          />
          <p className="text-xs text-gray-600 mt-1 text-right">
            {form.title.length} / {TITLE_MAX}
          </p>
        </div>

        <div>
          <label className="text-sm text-gray-400" htmlFor="news-body">
            Текст
          </label>
          <textarea
            id="news-body"
            value={form.body}
            maxLength={BODY_MAX}
            rows={7}
            onChange={(e) => set({ body: e.target.value })}
            className="mt-1 w-full rounded-xl border border-dark-600 bg-dark-900 px-3 py-2.5 outline-none focus:border-acid-400/60 leading-relaxed"
            placeholder="Абзацы разделяй пустой строкой. Ссылки вида https://... станут кликабельными."
          />
          <p className="text-xs text-gray-600 mt-1 text-right">
            {form.body.length} / {BODY_MAX}
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.important}
            onChange={(e) => set({ important: e.target.checked })}
            className="mt-1 w-4 h-4 shrink-0"
          />
          <span className="text-sm">
            Важная: показать окном при входе, нужно нажать «Прочитал(а)»
          </span>
        </label>

        {!alreadyLive && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.toGroup}
              onChange={(e) => set({ toGroup: e.target.checked })}
              className="mt-1 w-4 h-4 shrink-0"
            />
            <span className="text-sm">
              Отправить также в группу Telegram (анонс-тема)
              <span className="block text-xs text-gray-500">
                Придёт один раз, без звука, в момент публикации.
              </span>
            </span>
          </label>
        )}

        {preview && <Preview title={form.title} body={form.body} important={form.important} />}

        {msg && (
          <p className={`text-sm ${msg.kind === "err" ? "text-red-400" : "text-acid-400"}`}>{msg.text}</p>
        )}

        {confirming ? (
          <div className="rounded-xl border border-acid-400/40 bg-acid-400/[0.07] p-3 space-y-3">
            <p className="text-sm font-semibold">Точно опубликовать? Новость увидят все сотрудники</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => save("publish")}
                className="flex-1 rounded-xl bg-acid-400 text-black font-bold py-2.5 disabled:opacity-50"
              >
                {pending ? "Публикуем..." : "Да, опубликовать"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming(false)}
                className="rounded-xl border border-dark-600 px-4 py-2.5 text-gray-300"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!valid || pending}
              onClick={() => setPreview((p) => !p)}
              className="rounded-xl border border-dark-600 px-4 py-2.5 text-gray-300 disabled:opacity-40"
            >
              {preview ? "Скрыть предпросмотр" : "Предпросмотр"}
            </button>
            <button
              type="button"
              disabled={!valid || pending}
              onClick={() => setConfirming(true)}
              className="rounded-xl bg-acid-400 text-black font-bold px-4 py-2.5 disabled:opacity-40"
            >
              {alreadyLive ? "Сохранить изменения" : "Опубликовать"}
            </button>
            {!alreadyLive && (
              <button
                type="button"
                disabled={!valid || pending}
                onClick={() => save("draft")}
                className="rounded-xl border border-dark-600 px-4 py-2.5 text-gray-300 disabled:opacity-40"
              >
                Сохранить черновик
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Все новости</h2>
        {items.length === 0 && (
          <p className="text-sm text-gray-500">Пока ни одной. Первую можно написать выше.</p>
        )}
        {items.map((n) => (
          <div key={n.id} className="rounded-2xl border border-dark-700 bg-dark-800 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold break-words">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{n.when}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={`text-xs rounded-full px-2 py-0.5 border ${
                    n.published
                      ? "border-acid-400/40 text-acid-400"
                      : "border-dark-600 text-gray-400"
                  }`}
                >
                  {n.published ? "Опубликована" : "Черновик"}
                </span>
                {n.important && (
                  <span className="text-xs rounded-full px-2 py-0.5 border border-amber-500/40 text-amber-400">
                    Важная
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-2 line-clamp-2 whitespace-pre-line">{n.body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              {n.published && (
                <span className="text-gray-400">
                  Прочитали {n.reads} из {staffTotal}
                </span>
              )}
              <span className="flex-1" />
              <button type="button" onClick={() => edit(n)} className="text-gray-300 underline underline-offset-2">
                Править
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => toggle(n)}
                className="text-gray-300 underline underline-offset-2 disabled:opacity-50"
              >
                {n.published ? "Снять с публикации" : "Опубликовать без отправки в группу"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
