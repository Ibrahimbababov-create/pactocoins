"use client";

import { useState, useTransition } from "react";
import { setMyRop } from "@/app/mop/actions";

export default function RopPicker({ rops = [], currentRopId }) {
  const [value, setValue] = useState(currentRopId ?? "");
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState(null);

  function save(next) {
    setValue(next);
    setMsg(null);
    start(async () => {
      const res = await setMyRop(next || null);
      setMsg(res?.error ? { t: "e", x: res.error } : { t: "ok", x: "Сохранено" });
    });
  }

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-2">
      <p className="text-sm text-gray-500">Мой руководитель</p>
      <select
        value={value}
        disabled={isPending}
        onChange={(e) => save(e.target.value)}
        className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
      >
        <option value="">Не выбран</option>
        {rops.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      {msg && (
        <p
          className={`text-xs ${
            msg.t === "e" ? "text-red-400" : "text-acid-400"
          }`}
        >
          {msg.x}
        </p>
      )}
    </div>
  );
}
