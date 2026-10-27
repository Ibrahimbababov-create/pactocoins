"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Icon from "@/components/Icon";
import {
  createCategory,
  deleteCategory,
  reorderCategories,
} from "@/app/admin/actions";

export default function CategoriesManager({ categories }) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(categories);
  // Свёрнуто по умолчанию: 18 категорий стояли над наградами, и до самих
  // наград приходилось каждый раз листать.
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);

  // Пока порядок не сохранился, не даём свежим данным с сервера откатить
  // то, что админ уже переставил на экране.
  const saveTimer = useRef(null);
  const latest = useRef(categories);

  useEffect(() => {
    if (saveTimer.current) return;
    setItems(categories);
  }, [categories]);

  function scheduleSave(next) {
    latest.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      startTransition(async () => {
        const res = await reorderCategories(latest.current.map((c) => c.id));
        if (res?.error) showMessage(res.error, "error");
      });
    }, 500);
  }

  function move(index, dir) {
    const to = index + dir;
    if (to < 0 || to >= items.length) return;
    const updated = [...items];
    [updated[index], updated[to]] = [updated[to], updated[index]];
    setItems(updated);
    scheduleSave(updated);
  }

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }

  function handleAdd(e) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createCategory(newName);
      if (res.error) showMessage(res.error, "error");
      else {
        showMessage("Категория добавлена");
        setNewName("");
      }
    });
  }

  function handleDelete(id, name) {
    const confirmed = window.confirm(
      `Удалить категорию "${name}"? Награды в ней останутся, но категория пропадёт из списка — их нужно будет переназначить вручную.`
    );
    if (!confirmed) return;
    startTransition(() => deleteCategory(id));
  }

  function handleDragStart(index) {
    setDragIndex(index);
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...items];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setDragIndex(index);
    setItems(updated);
  }

  function handleDrop() {
    if (dragIndex === null) return;
    setDragIndex(null);
    scheduleSave(items);
  }

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="font-semibold">Категории · {items.length}</span>
        <span className="text-xs text-gray-500">{open ? "Свернуть" : "Изменить"}</span>
      </button>

      {open && (
      <>
      <p className="text-sm text-gray-500">
        Стрелками двигай категорию вверх или вниз (на компьютере можно ещё перетащить). Порядок сохраняется сам.
      </p>

      {message && (
        <div
          className={`rounded-lg p-2 text-xs text-center ${
            message.type === "error"
              ? "bg-red-500/10 text-red-400"
              : "bg-acid-400/10 text-acid-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-1">
        {items.map((c, i) => (
          <div
            key={c.id}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={handleDrop}
            onDragEnd={handleDrop}
            className={`flex items-center justify-between bg-dark-700 rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing select-none ${
              dragIndex === i ? "opacity-40" : ""
            }`}
          >
            <div className="flex items-center gap-2">
                            <span className="text-sm">{c.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Выше"
                className="w-8 h-8 flex items-center justify-center rounded bg-dark-600 text-gray-300 disabled:opacity-30"
              >
                <Icon name="chevronDown" className="w-4 h-4 rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                aria-label="Ниже"
                className="w-8 h-8 flex items-center justify-center rounded bg-dark-600 text-gray-300 disabled:opacity-30"
              >
                <Icon name="chevronDown" className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(c.id, c.name)}
                disabled={isPending}
                className="text-xs bg-red-500/20 text-red-400 rounded px-2 h-8 ml-1"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Новая категория"
          className="flex-1 min-w-0 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm"
        >
          Добавить
        </button>
      </form>
      </>
      )}
    </div>
  );
}
