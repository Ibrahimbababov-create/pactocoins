"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import { applyRevenueEdit, rejectRevenueEdit } from "@/app/admin/revenueEditActions";
import { EDIT_FIELD_LABELS, editValueText } from "@/lib/revenueEdits";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import { formatCoins } from "@/lib/plural";

const STATUS = {
  approved: { label: "Применено", color: "bg-acid-400/10 text-acid-400" },
  rejected: { label: "Отклонено", color: "bg-red-500/10 text-red-400" },
  pending: { label: "Ждёт", color: "bg-amber-500/10 text-amber-400" },
};

const PAYMENT_STATUS = {
  approved: "подтверждена",
  pending: "ждёт одобрения",
  rejected: "отменена",
};

function Changes({ item }) {
  const fields = Object.keys(item.proposed).filter((f) => EDIT_FIELD_LABELS[f]);
  const base = item.status === "pending" ? item.current : item.original;
  return (
    <div className="bg-dark-900/60 border border-dark-700 rounded-lg divide-y divide-dark-700">
      {fields.map((f) => {
        const drifted = item.status === "pending" && item.drift.includes(f);
        return (
          <div key={f} className="px-3 py-2 text-sm">
            <p className="text-[11px] text-gray-500">{EDIT_FIELD_LABELS[f]}</p>
            <p className="break-words">
              <span className="text-gray-400">{editValueText(f, base?.[f])}</span>
              <span className="text-gray-600"> → </span>
              <span className="font-semibold text-ink">{editValueText(f, item.proposed[f])}</span>
            </p>
            {drifted && (
              <p className="text-xs text-orange-400 mt-0.5">
                При подаче было {editValueText(f, item.original?.[f])}: оплату уже меняли
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PendingCard({ item, onDone }) {
  const [isPending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [error, setError] = useState(null);
  const gone = !item.current || item.paymentStatus === "rejected";
  const drifted = item.drift.length > 0;

  function apply() {
    setError(null);
    startTransition(async () => {
      const res = await applyRevenueEdit(item.id);
      if (res?.error) return setError(res.error);
      const coins =
        res.diff > 0
          ? `, начислено ещё ${formatCoins(res.diff)}`
          : res.diff < 0
          ? `, списано ${formatCoins(-res.diff)}`
          : "";
      onDone(item.id, `Исправление применено${coins}`);
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      const res = await rejectRevenueEdit(item.id, comment);
      if (res?.error) return setError(res.error);
      onDone(item.id, "Исправление отклонено");
    });
  }

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-3 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold break-words">{item.userName}</p>
          <p className="text-xs text-gray-500 break-words">
            Клиент: {item.current?.client_name || item.original?.client_name || "без ФИО"}
            {item.current ? `, ${editValueText("amount_kzt", item.current.amount_kzt)}` : ""}
            {item.paymentStatus ? `, оплата ${PAYMENT_STATUS[item.paymentStatus] ?? item.paymentStatus}` : ""}
          </p>
        </div>
        <span className="text-[11px] text-gray-500 shrink-0">{formatDateTimeAlmaty(item.createdAt)}</span>
      </div>

      <Changes item={item} />

      <div className="text-sm">
        <p className="text-[11px] text-gray-500">Что не так</p>
        <p className="break-words whitespace-pre-line">{item.reason}</p>
      </div>

      {gone && (
        <p className="text-xs text-orange-400">
          Оплату уже отменили или отклонили. Применить нельзя, отклоните исправление.
        </p>
      )}
      {!gone && drifted && (
        <p className="text-xs text-orange-400">
          Оплату изменили после подачи исправления. Применить нельзя: отклоните, сотрудник подаст
          новое по актуальным данным.
        </p>
      )}
      {!gone && !drifted && item.paymentStatus === "pending" && (
        <p className="text-xs text-gray-500">
          Оплата ещё не одобрена: поменяется сама заявка, коины посчитаются при одобрении.
        </p>
      )}

      {error && <p className="text-sm text-red-400 break-words">{error}</p>}

      <div className="space-y-2">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          placeholder="Комментарий сотруднику, если отклоняете"
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={isPending || gone || drifted}
            className="flex-1 bg-acid-400 text-black font-semibold rounded-lg py-2 text-sm disabled:opacity-40"
          >
            {isPending ? "Секунду..." : "Применить"}
          </button>
          <button
            type="button"
            onClick={reject}
            disabled={isPending}
            className="flex-1 bg-red-500/15 text-red-400 font-semibold rounded-lg py-2 text-sm disabled:opacity-40"
          >
            Отклонить
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RevenueEditsClient({ pending, recent }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(() => new Set());
  const [message, setMessage] = useState(null);

  function onDone(id, text) {
    setHidden((prev) => new Set(prev).add(id));
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
    router.refresh();
  }

  const queue = pending.filter((p) => !hidden.has(p.id));

  return (
    <div className="space-y-4">
      {message && (
        <div className="bg-acid-400/10 border border-acid-400/30 text-acid-400 rounded-xl px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {queue.length === 0 ? (
        <EmptyState
          icon="check"
          title="Очередь пуста"
          hint="Новых исправлений нет. Когда сотрудник предложит исправить оплату, она появится здесь."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {queue.map((item) => (
            <PendingCard key={item.id} item={item} onDone={onDone} />
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 px-1">Недавние решения</p>
          {recent.map((item) => {
            const meta = STATUS[item.status] ?? STATUS.pending;
            return (
              <div
                key={item.id}
                className="bg-dark-800 border border-dark-700 rounded-xl p-3 space-y-2 min-w-0"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold break-words min-w-0">{item.userName}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500">
                      {formatDateTimeAlmaty(item.reviewedAt || item.createdAt)}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                </div>
                <Changes item={item} />
                <p className="text-xs text-gray-500 break-words">Причина: {item.reason}</p>
                {item.adminComment && (
                  <p className="text-xs text-gray-400 break-words">Комментарий: {item.adminComment}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
