"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EmployeePicker from "@/components/EmployeePicker";
import { setAttendanceUntil, setAttendancePerson } from "@/app/admin/attendanceActions";

const STATUS = {
  approved: { text: "засчитано", cls: "text-acid-400" },
  pending: { text: "ждёт тебя", cls: "text-amber-400" },
  rejected: { text: "отклонено", cls: "text-gray-500" },
};

const input = "bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white";

export default function AttendanceAdminClient({ config, employees, today }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(null);
  const [until, setUntil] = useState(config.until);
  const [pickId, setPickId] = useState("");
  const [pickTime, setPickTime] = useState("12:00");

  const run = (fn) => {
    setMsg(null);
    start(async () => {
      const res = await fn();
      setMsg(res?.error ? { error: res.error } : { ok: "Сохранено" });
      router.refresh();
    });
  };

  const name = (id) => employees.find((e) => e.id === id)?.name ?? "Уволен или удалён";
  const own = Object.entries(config.people ?? {}).sort((a, b) => name(a[0]).localeCompare(name(b[0]), "ru"));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dark-600 bg-dark-800 p-4 space-y-3">
        <p className="font-semibold">Для всех</p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Засчитывать само, если кружок до</span>
          <input type="time" value={until} onChange={(e) => setUntil(e.target.value)} className={input} />
        </div>
        <button
          type="button"
          disabled={pending || until === config.until}
          onClick={() => run(() => setAttendanceUntil(until))}
          className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          Сохранить
        </button>
        <p className="text-xs text-gray-500">Время включительно: при 11:15 кружок в 11:15 засчитается, в 11:16 уже нет.</p>
      </div>

      <div className="rounded-2xl border border-dark-600 bg-dark-800 p-4 space-y-3">
        <p className="font-semibold">Своё время</p>
        <p className="text-xs text-gray-500">
          Для тех, у кого другой график. Можно поставить «всё мне на решение», тогда сам не засчитывается никогда.
        </p>
        {own.length > 0 && (
          <div className="divide-y divide-dark-700 rounded-xl border border-dark-600">
            {own.map(([id, value]) => (
              <div key={id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 truncate text-sm">{name(id)}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-sm tabular-nums text-gray-300">
                    {value === "off" ? "всё на решение" : `до ${value}`}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setAttendancePerson(id, ""))}
                    className="text-xs text-gray-500 underline disabled:opacity-50"
                  >
                    как у всех
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
        <EmployeePicker employees={employees} value={pickId} onChange={setPickId} placeholder="Кому поставить своё время…" />
        {pickId && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="time" value={pickTime} onChange={(e) => setPickTime(e.target.value)} className={input} />
            <button
              type="button"
              disabled={pending || !pickTime}
              onClick={() =>
                run(async () => {
                  const res = await setAttendancePerson(pickId, pickTime);
                  if (!res?.error) setPickId("");
                  return res;
                })
              }
              className="bg-acid-400 text-black font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-50"
            >
              Поставить {name(pickId)} до {pickTime}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await setAttendancePerson(pickId, "off");
                  if (!res?.error) setPickId("");
                  return res;
                })
              }
              className="border border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-300 disabled:opacity-50"
            >
              Всё мне на решение
            </button>
          </div>
        )}
      </div>

      {msg?.error && <p className="text-sm text-red-400">{msg.error}</p>}
      {msg?.ok && <p className="text-sm text-acid-400">{msg.ok}</p>}

      <div className="space-y-2">
        <p className="text-sm text-gray-500 px-1">Сегодня · {today.length}</p>
        {today.length === 0 ? (
          <p className="text-sm text-gray-500 px-1">Пока никто не отметился.</p>
        ) : (
          <div className="divide-y divide-dark-700 rounded-2xl border border-dark-600 bg-dark-800">
            {today.map((r) => (
              <div key={r.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm">{r.name}</span>
                  <span className={`shrink-0 text-xs ${STATUS[r.status]?.cls ?? "text-gray-400"}`}>
                    {STATUS[r.status]?.text ?? r.status}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">{r.comment || `заявка из приложения в ${r.at}`}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
