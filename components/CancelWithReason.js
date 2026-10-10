"use client";

import { useState } from "react";

// Поле причины держит текст у себя. Раньше он лежал в состоянии всего
// списка, и каждая буква перерисовывала все три сотни строк истории —
// от этого браузер вставал колом на полминуты.
export default function CancelWithReason({
  onCancel,
  disabled = false,
  placeholder = "Причина отмены сотруднику (необязательно)",
  label = "Отменить одобрение",
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-[160px] bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-xs text-white"
      />
      <button
        type="button"
        onClick={() => onCancel(reason)}
        disabled={disabled}
        className="text-xs bg-red-500/20 text-red-400 rounded-lg px-3 py-1.5 shrink-0 disabled:opacity-50"
      >
        {label}
      </button>
    </div>
  );
}
