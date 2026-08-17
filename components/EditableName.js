"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { updateMyName } from "@/app/mop/actions";

function PencilIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default function EditableName({ name }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [currentName, setCurrentName] = useState(name);
  const [value, setValue] = useState(name);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function cancel() {
    setEditing(false);
    setValue(currentName);
    setError(null);
  }

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
      <form onSubmit={handleSave} className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && cancel()}
            maxLength={50}
            className="flex-1 min-w-0 bg-dark-700 border border-acid-400 rounded-lg px-3 py-2 text-white text-lg font-bold focus:outline-none"
          />
          <button
            type="submit"
            disabled={isPending}
            aria-label="Сохранить"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-acid-400 text-black disabled:opacity-50"
          >
            <CheckIcon />
          </button>
          <button
            type="button"
            onClick={cancel}
            aria-label="Отменить"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-dark-700 text-gray-400 hover:text-white"
          >
            <XIcon />
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-lg font-bold truncate">{currentName}</p>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Изменить имя"
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-dark-700 text-gray-400 hover:text-acid-400 hover:bg-dark-600 transition"
      >
        <PencilIcon />
      </button>
    </div>
  );
}
