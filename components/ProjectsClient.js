"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import {
  createProject,
  renameProject,
  setProjectActive,
  setProjectRops,
} from "@/app/admin/projectActions";

export default function ProjectsClient({ projects, rops, peopleByProject }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState(null);

  function run(fn) {
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setMessage({ type: "error", text: res.error });
      else {
        setMessage(null);
        setEditingId(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl p-4">
        <p className="text-sm text-gray-500">Новый проект</p>
        <div className="flex gap-2 mt-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Например, Шолпан или Мёд"
            className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={isPending || !newName.trim()}
            onClick={() =>
              run(async () => {
                const res = await createProject(newName);
                if (!res?.error) setNewName("");
                return res;
              })
            }
            className="bg-acid-400 text-black font-bold rounded-lg px-4 text-sm disabled:opacity-40"
          >
            Создать
          </button>
        </div>
      </div>

      {message && (
        <p className="text-sm text-red-400">{message.text}</p>
      )}

      {projects.length === 0 && (
        <p className="text-sm text-gray-500">
          Проектов пока нет. Создай первый — потом закрепишь за ним РОПов и
          менеджеров.
        </p>
      )}

      {projects.map((p) => {
        const people = peopleByProject[p.id] ?? [];
        const assigned = new Set((p.rops ?? []).map((r) => r.id));

        return (
          <div
            key={p.id}
            className={`bg-dark-800 border rounded-2xl p-4 space-y-3 ${
              p.is_active ? "border-dark-700" : "border-dark-700 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {editingId === p.id ? (
                  <form
                    action={(fd) =>
                      run(() => renameProject(p.id, fd.get("name")))
                    }
                    className="flex gap-2"
                  >
                    <input
                      name="name"
                      defaultValue={p.name}
                      className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-1.5 text-sm"
                    />
                    <button className="text-sm text-acid-400 font-semibold">
                      Сохранить
                    </button>
                  </form>
                ) : (
                  <p className="font-display font-bold text-lg truncate">
                    {p.name}
                    {!p.is_active && (
                      <span className="text-xs text-gray-500 font-sans font-normal ml-2">
                        закрыт
                      </span>
                    )}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {people.length === 0
                    ? "никого не закреплено"
                    : `${people.length} чел.: ${people
                        .map((u) => u.name)
                        .join(", ")}`}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingId(editingId === p.id ? null : p.id)}
                  className="text-xs text-gray-400 border border-dark-600 rounded-lg px-2.5 py-1.5"
                >
                  Переименовать
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => setProjectActive(p.id, !p.is_active))}
                  className="text-xs text-gray-400 border border-dark-600 rounded-lg px-2.5 py-1.5"
                >
                  {p.is_active ? "Закрыть" : "Вернуть"}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Кто ведёт проект</p>
              <div className="flex flex-wrap gap-2">
                {rops.map((r) => {
                  const on = assigned.has(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        const next = new Set(assigned);
                        if (on) next.delete(r.id);
                        else next.add(r.id);
                        run(() => setProjectRops(p.id, [...next]));
                      }}
                      className={`text-xs rounded-full px-3 py-1.5 border flex items-center gap-1.5 ${
                        on
                          ? "bg-acid-400/10 border-acid-400 text-acid-400 font-semibold"
                          : "border-dark-600 text-gray-400"
                      }`}
                    >
                      {on && <Icon name="check" className="w-3 h-3" strokeWidth={3} />}
                      {r.name}
                    </button>
                  );
                })}
                {rops.length === 0 && (
                  <span className="text-xs text-gray-500">
                    Сначала назначь кому-нибудь роль РОПа
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
