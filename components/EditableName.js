"use client";

import { useState, useTransition } from "react";
import { updateMyName } from "@/app/mop/actions";

export default function EditableName({ name }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [currentName, setCurrentName] = useState(name);
  const [value, setValue] = useState(name);
  const [error, setError] = useState(null);

  function handleSave(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Укажи имя");
      return;
    }
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("name", trimmed);
      const res = await updateMyName(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setCurrentName(trimmed);
        setEditing(false);
      }
    });
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex items-center gap-1.5">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={50}
          className="bg-dark-700 border border-dark-600 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-acid-400"
        />
        <button
          type="submit"
          disabled={isPending}
          className="text-xs bg-acid-400 text-black font-bold rounded-lg px-2 py-1 disabled:opacity-50"
        >
          ✓
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setValue(currentName);
            setError(null);
          }}
          className="text-xs text-gray-500 px-1"
        >
          ✕
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </form>
    );
  }

  return (
    <p className="text-gray-500 text-sm flex items-center gap-1.5">
      Привет, {currentName}
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Изменить имя"
        className="text-gray-600 hover:text-acid-400 text-xs leading-none"
      >
        ✏️
      </button>
    </p>
  );
}
