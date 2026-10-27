"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { submitRevenueEdit } from "@/app/mop/payments/actions";
import { haptic } from "@/lib/haptics";
import { revenueKindText } from "@/lib/revenueKinds";
import { formatPaymentDay } from "@/lib/timezone";
import { EDIT_REASON_MAX, editDateBounds, paymentDayKey } from "@/lib/revenueEdits";

function money(n) {
  return Number(n ?? 0).toLocaleString("ru-RU");
}

// Шторка «Предложить исправление»: текущие значения оплаты сверху, ниже
// поля с новыми. Отправляется админу, сама оплата не меняется.
export default function PaymentEditSheet({ row, onClose }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  const currentDay = paymentDayKey(row);
  const bounds = editDateBounds();

  const [amount, setAmount] = useState(String(row.amount_kzt ?? ""));
  const [day, setDay] = useState(currentDay || bounds.max);
  const [clientName, setClientName] = useState(row.client_name ?? "");
  const [productKind, setProductKind] = useState(row.product_kind ?? "");
  const [payKind, setPayKind] = useState(row.pay_kind ?? "");
  const [isFinalPart, setIsFinalPart] = useState(row.is_final_part === true);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) return setError("Напиши, что не так с оплатой");
    if (!productKind) return setError("Выбери продукт");
    if (!payKind) return setError("Выбери вид оплаты");

    startTransition(async () => {
      const res = await submitRevenueEdit(row.id, {
        amountKzt: amount,
        paymentDay: day,
        clientName,
        productKind,
        payKind,
        isFinalPart,
        reason,
      });
      if (res?.error) {
        haptic.error();
        return setError(res.error);
      }
      haptic.success();
      onClose(true);
      router.refresh();
    });
  }

  if (typeof document === "undefined") return null;

  const segBtn = (active) =>
    `flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
      active
        ? "border-acid-400 bg-acid-400/15 text-acid-400"
        : "border-dark-600 bg-dark-700 text-gray-300"
    }`;

  const inputCls =
    "w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-acid-400";

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60"
      onClick={() => onClose()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-dark-800 border border-dark-600 rounded-t-2xl p-5 space-y-4 w-full max-w-lg max-h-[92vh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <p className="font-semibold">Исправить оплату</p>
          <button type="button" onClick={() => onClose()} className="text-gray-500 text-sm">
            Отмена
          </button>
        </div>

        <div className="bg-dark-700/60 border border-dark-600 rounded-lg px-4 py-3 text-sm space-y-0.5">
          <p className="text-[11px] text-gray-500">Сейчас</p>
          <p className="font-semibold break-words">{row.client_name || "без ФИО"}</p>
          <p className="text-gray-400">
            {money(row.amount_kzt)} ₸ · {formatPaymentDay(row.earned_at || row.created_at)}
            {revenueKindText(row) ? ` · ${revenueKindText(row)}` : ""}
          </p>
        </div>

        <p className="text-xs text-gray-500 leading-snug">
          Поменяй то, что указано неверно. Оплата изменится, только когда админ одобрит исправление.
        </p>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Сумма, ₸</label>
          <input
            type="number"
            inputMode="numeric"
            required
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputCls}
          />
          {Number(amount) > 0 && (
            <p className="text-xs mt-1 text-white font-semibold tabular-nums">
              {Math.round(Number(amount)).toLocaleString("ru-RU")} ₸
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Дата оплаты</label>
          <input
            type="date"
            required
            value={day}
            min={currentDay && currentDay < bounds.min ? currentDay : bounds.min}
            max={bounds.max}
            onChange={(e) => setDay(e.target.value)}
            className={inputCls}
          />
          <p className="text-xs text-gray-500 mt-1">С начала прошлого месяца по сегодня</p>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">ФИО клиента</label>
          <input
            type="text"
            required
            maxLength={80}
            name="client-fio-no-memory"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className={inputCls}
            placeholder="Фамилия Имя"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Продукт</label>
          <div className="flex gap-2">
            <button type="button" className={segBtn(productKind === "course")} onClick={() => setProductKind("course")}>
              Курс
            </button>
            <button type="button" className={segBtn(productKind === "intensive")} onClick={() => setProductKind("intensive")}>
              Интенсив / МК
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Оплата</label>
          <div className="flex gap-2">
            <button type="button" className={segBtn(payKind === "full")} onClick={() => setPayKind("full")}>
              Целиком
            </button>
            <button type="button" className={segBtn(payKind === "part")} onClick={() => setPayKind("part")}>
              Часть
            </button>
          </div>
          {payKind === "part" && (
            <label className="flex items-center gap-3 mt-2 bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isFinalPart}
                onChange={(e) => setIsFinalPart(e.target.checked)}
              />
              <span className="text-sm text-gray-300">Это последняя часть</span>
            </label>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Что не так</label>
          <textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={EDIT_REASON_MAX}
            rows={3}
            className={inputCls}
            placeholder="Например: опечатка в сумме, клиент заплатил 150 000, а не 1 500 000"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-acid-400 text-black font-bold rounded-lg py-3 hover:bg-acid-500 transition disabled:opacity-50"
        >
          {isPending ? "Отправляем..." : "Отправить админу"}
        </button>
      </form>
    </div>,
    document.body
  );
}
