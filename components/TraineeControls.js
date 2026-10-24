"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import {
  takeTrainee,
  releaseTrainee,
  dismissTrainee,
} from "@/app/mop/mentorActions";

// Кнопки наставника под карточкой стажёра. Чужого можно забрать себе,
// своего — отпустить или закрыть доступ. Увольнение переспрашивает, потому
// что отменить его из этого экрана уже нельзя.
export default function TraineeControls({ traineeId, mine }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState(null);

  function run(fn, ...args) {
    setError(null);
    startTransition(async () => {
      const res = await fn(...args);
      if (res?.error) return setError(res.error);
      setAsking(false);
      router.refresh();
    });
  }

  if (!mine) {
    return (
      <>
        <button
          onClick={() => run(takeTrainee, traineeId)}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 text-sm text-acid-400 border border-acid-400/40 rounded-xl py-2.5 active:opacity-60 disabled:opacity-40"
        >
          <Icon name="users" className="w-4 h-4" />
          Взять под себя
        </button>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </>
    );
  }

  if (asking) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">
          Закрыть доступ в PactoCoins? Сообщение ему не придёт — скажи сам.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => run(dismissTrainee, traineeId)}
            disabled={isPending}
            className="flex-1 rounded-xl py-2 text-sm font-semibold bg-red-500/20 text-red-400 disabled:opacity-40"
          >
            Закрыть доступ
          </button>
          <button
            onClick={() => setAsking(false)}
            className="flex-1 rounded-xl py-2 text-sm text-gray-400 border border-dark-600"
          >
            Назад
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => run(releaseTrainee, traineeId)}
          disabled={isPending}
          className="flex-1 text-xs text-gray-400 border border-dark-600 rounded-xl py-2 active:opacity-60 disabled:opacity-40"
        >
          Снять с себя
        </button>
        <button
          onClick={() => setAsking(true)}
          disabled={isPending}
          className="flex-1 text-xs text-red-400/80 border border-dark-600 rounded-xl py-2 active:opacity-60 disabled:opacity-40"
        >
          Уволить
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </>
  );
}
