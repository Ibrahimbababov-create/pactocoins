"use client";

import { useState, useTransition } from "react";
import { createCategory, moveCategory, deleteCategory } from "@/app/admin/actions";

export default function CategoriesManager({ categories }) {
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState(null);

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

  function handleMove(id, direction) {
    startTransition(() => moveCategory(id, direction));
  }

  function handleDelete(id, name) {
    const confirmed = window.confirm(
      `Удалить категорию "${name}"? Награды в ней останутся, но категория пропадёт из списка — их нужно будет переназначить вручную.`
    );
    if (!confirmed) return;
    startTransition(() => deleteCategory(id));
  }

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3">
      <p className="text-sm text-gray-500">Категории (порядок на экране)</p>

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
        {categories.map((c, i) => (
          <div
            key={c.id}
            className="flex items-center justify-between bg-dark-700 rounded-lg px-3 py-2"
          >
            <span className="text-sm">{c.name}</span>
            <div className="flex gap-1">
              <button
                onClick={() => handleMove(c.id, "up")}
                disabled={isPending || i === 0}
                className="text-xs bg-dark-600 rounded px-2 py-1 disabled:opacity-30"
              >
                ▲
              </button>
              <button
                onClick={() => handleMove(c.id, "down")}
                disabled={isPending || i === categories.length - 1}
                className="text-xs bg-dark-600 rounded px-2 py-1 disabled:opacity-30"
              >
                ▼
              </button>
              <button
                onClick={() => handleDelete(c.id, c.name)}
                disabled={isPending}
                className="text-xs bg-red-500/20 text-red-400 rounded px-2 py-1"
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
