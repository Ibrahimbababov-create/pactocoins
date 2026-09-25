"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/Icon";

// Выпадающий список на 25 имён — это пытка. Здесь поиск и галочки:
// отметил сколько нужно, нажал «Добавить» — все ушли одним действием.
export default function PeopleMultiPicker({
  people,
  onAdd,
  disabled = false,
  label = "Добавить людей",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(() => new Set());

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((u) => u.name.toLowerCase().includes(q));
  }, [people, query]);

  function toggle(id) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    if (picked.size === 0) return;
    onAdd([...picked]);
    setPicked(new Set());
    setQuery("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="text-xs rounded-full px-3 py-1.5 border border-dark-600 text-gray-300 flex items-center gap-1.5 disabled:opacity-40"
      >
        <Icon name="plus" className="w-3 h-3" strokeWidth={2.5} />
        {label}
      </button>
    );
  }

  return (
    <div className="w-full bg-dark-900/60 border border-dark-600 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти по имени"
          className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPicked(new Set());
            setQuery("");
          }}
          className="text-xs text-gray-500 px-2"
        >
          Отмена
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto divide-y divide-dark-700">
        {found.length === 0 && (
          <p className="text-xs text-gray-500 py-3">Никого не нашлось</p>
        )}
        {found.map((u) => {
          const on = picked.has(u.id);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => toggle(u.id)}
              className="w-full flex items-center gap-3 py-2.5 text-left"
            >
              <span
                className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                  on ? "bg-acid-400 border-acid-400" : "border-dark-500"
                }`}
              >
                {on && (
                  <Icon
                    name="check"
                    className="w-3 h-3 text-black"
                    strokeWidth={3}
                  />
                )}
              </span>
              <span className="text-sm flex-1 truncate">{u.name}</span>
              {u.hint && (
                <span className="text-xs text-gray-600 shrink-0">{u.hint}</span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={picked.size === 0 || disabled}
        onClick={confirm}
        className="w-full bg-acid-400 text-black font-bold rounded-lg py-2 text-sm disabled:opacity-40"
      >
        {picked.size === 0
          ? "Отметь галочками"
          : `Добавить ${picked.size}`}
      </button>
    </div>
  );
}
