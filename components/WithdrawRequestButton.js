"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withdrawMyRequest } from "@/app/mop/withdrawActions";
import { haptic } from "@/lib/haptics";

// «Отозвать» у своей ожидающей заявки — с подтверждением, чтобы не
// снять заявку случайным тапом.
export default function WithdrawRequestButton({ kind, id }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  if (error) {
    return <span className="text-xs text-red-400 shrink-0 max-w-[45%] text-right">{error}</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          haptic.light();
          setConfirming(true);
        }}
        className="shrink-0 text-xs text-gray-500 px-2 py-1 -mr-2"
      >
        Отозвать
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await withdrawMyRequest(kind, id);
            if (res?.error) {
              haptic.error();
              setError(res.error);
              return;
            }
            haptic.success();
            router.refresh();
          })
        }
        className="text-xs font-bold text-red-400 px-2 py-1 disabled:opacity-50"
      >
        {pending ? "…" : "Да, отозвать"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="text-xs text-gray-500 px-2 py-1 -mr-2"
      >
        Нет
      </button>
    </div>
  );
}
