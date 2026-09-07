"use client";

import { useState, useTransition } from "react";
import {
  createSharedOnboardingItem,
  updateSharedOnboardingItem,
  deleteSharedOnboardingItem,
} from "@/app/admin/actions";
import {
  createMyOnboardingItem,
  updateMyOnboardingItem,
  deleteMyOnboardingItem,
} from "@/app/mop/actions";
import { ONBOARDING_DAYS, ONBOARDING_TYPES } from "@/lib/onboardingDays";

const TYPE_OPTIONS = Object.entries(ONBOARDING_TYPES).map(([value, meta]) => ({
  value,
  label: `${meta.icon} ${meta.label}`,
}));

function ItemForm({ item, onSubmit, onCancel, pending }) {
  const [type, setType] = useState(item?.type ?? "link");

  return (
    <form action={onSubmit} className="space-y-2">
      <div className="flex gap-2">
        <select
          name="day"
          defaultValue={item?.day ?? 1}
          className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        >
          {ONBOARDING_DAYS.map((d) => (
            <option key={d.day} value={d.day}>
              День {d.day}
            </option>
          ))}
        </select>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          name="sort"
          type="number"
          defaultValue={item?.sort ?? 0}
          title="Порядок внутри дня"
          className="w-16 bg-dark-700 border border-dark-600 rounded-lg px-2 py-2 text-white text-sm"
        />
      </div>
      <input
        name="section"
        defaultValue={item?.section ?? ""}
        placeholder="Раздел (напр. «Регламент работы»)"
        className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
      />
      <input
        name="title"
        required
        defaultValue={item?.title ?? ""}
        placeholder="Название материала"
        className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
      />
      {type !== "text" && (
        <input
          name="url"
          defaultValue={item?.url ?? ""}
          placeholder="Ссылка (Google Doc, видео, Telegram…)"
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        />
      )}
      <textarea
        name="body"
        defaultValue={item?.body ?? ""}
        rows={type === "text" ? 5 : 2}
        placeholder={
          type === "text"
            ? "Текст заметки (её увидит стажёр целиком)"
            : "Короткое описание (необязательно)"
        }
        className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-acid-400 text-black font-bold rounded-lg py-2 text-sm"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-dark-700 text-gray-400 rounded-lg py-2 text-sm"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

export default function OnboardingItemsEditor({ scope, items = [] }) {
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState(null);

  const actions =
    scope === "shared"
      ? {
          create: createSharedOnboardingItem,
          update: updateSharedOnboardingItem,
          remove: deleteSharedOnboardingItem,
        }
      : {
          create: createMyOnboardingItem,
          update: updateMyOnboardingItem,
          remove: deleteMyOnboardingItem,
        };

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }

  function handleCreate(formData) {
    startTransition(async () => {
      const res = await actions.create(formData);
      if (res?.error) showMessage(res.error, "error");
      else {
        showMessage("Добавлено");
        setShowCreate(false);
      }
    });
  }

  function handleUpdate(id, formData) {
    startTransition(async () => {
      const res = await actions.update(id, formData);
      if (res?.error) showMessage(res.error, "error");
      else {
        showMessage("Обновлено");
        setEditingId(null);
      }
    });
  }

  function handleDelete(id, title) {
    if (!window.confirm(`Удалить «${title}»?`)) return;
    startTransition(async () => {
      const res = await actions.remove(id);
      if (res?.error) showMessage(res.error, "error");
      else showMessage("Удалено");
    });
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`rounded-xl p-3 text-sm text-center ${
            message.type === "error"
              ? "bg-red-500/10 text-red-400"
              : "bg-acid-400/10 text-acid-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="bg-acid-400 text-black font-bold rounded-xl px-4 py-2 text-sm"
        >
          + Добавить материал
        </button>
      ) : (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <p className="font-semibold mb-3">Новый материал</p>
          <ItemForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            pending={isPending}
          />
        </div>
      )}

      {ONBOARDING_DAYS.map((d) => {
        const dayItems = items
          .filter((i) => i.day === d.day)
          .sort(
            (a, b) =>
              (a.sort ?? 0) - (b.sort ?? 0) ||
              (a.created_at ?? "").localeCompare(b.created_at ?? "")
          );
        return (
          <div key={d.day} className="space-y-2">
            <p className="text-sm font-bold text-gray-300">
              День {d.day} · {d.title}{" "}
              <span className="text-gray-600 font-normal">
                · {dayItems.length}
              </span>
            </p>
            {dayItems.length === 0 && (
              <p className="text-xs text-gray-600">Пока нет материалов.</p>
            )}
            {dayItems.map((item) => (
              <div
                key={item.id}
                className="bg-dark-800 border border-dark-600 rounded-xl p-3"
              >
                {editingId === item.id ? (
                  <ItemForm
                    item={item}
                    onSubmit={(fd) => handleUpdate(item.id, fd)}
                    onCancel={() => setEditingId(null)}
                    pending={isPending}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">
                        {item.section || "Без раздела"} · #{item.sort ?? 0}
                      </p>
                      <p className="font-semibold text-sm">
                        {ONBOARDING_TYPES[item.type]?.icon ?? "🔗"} {item.title}
                      </p>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-acid-400 break-all"
                        >
                          {item.url}
                        </a>
                      )}
                      {item.body && (
                        <p className="text-xs text-gray-400 whitespace-pre-line mt-1 line-clamp-3">
                          {item.body}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => setEditingId(item.id)}
                        className="text-xs bg-dark-700 rounded-lg px-3 py-1.5"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.title)}
                        disabled={isPending}
                        className="text-xs bg-red-500/20 text-red-400 rounded-lg px-3 py-1.5"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
