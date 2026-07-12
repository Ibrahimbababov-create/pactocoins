"use client";

import { useState, useTransition, useEffect } from "react";
import {
  createCategory,
  deleteCategory,
  reorderCategories,
} from "@/app/admin/actions";

export default function CategoriesManager({ categories }) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(categories);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);

  useEffect(() => {
    setItems(categories);
  }, [categories]);

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
    setDragIndex(null);
    startTransition(() => reorderCategories(items.map((c) => c.id)));
  }

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3">
      <p className="text-sm text-gray-500">
        Категории — зажми и перетащи, чтобы поменять порядок
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
              <span className="text-gray-500">⠿⠿</span>
              <span className="text-sm">{c.name}</span>
            </div>
            <button
              onClick={() => handleDelete(c.id, c.name)}
              disabled={isPending}
              className="text-xs bg-red-500/20 text-red-400 rounded px-2 py-1"
            >
              Удалить
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Новая категория"
          className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm"
        >
          Добавить
        </button>
      </form>
    </div>
  );
}
