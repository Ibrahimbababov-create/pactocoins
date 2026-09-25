"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTraineeProject } from "@/app/mop/mentorActions";

export default function TraineeProjectPicker({ traineeId, projectId, projects }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(projectId ?? "");
  const [error, setError] = useState(null);

  function change(next) {
    const previous = value;
    setValue(next);
    setError(null);

    startTransition(async () => {
      const res = await setTraineeProject(traineeId, next || null);
      if (res?.error) {
        setValue(previous);
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <select
        value={value}
        disabled={isPending}
        onChange={(e) => change(e.target.value)}
        className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2.5 text-sm text-ink"
      >
        <option value="">Проект не выбран</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
