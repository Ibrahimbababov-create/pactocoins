"use client";

import { formatCoins } from "@/lib/plural";
import { tieredRevenueCoins } from "@/lib/coinRate";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { submitRevenueRequest } from "@/app/mop/revenue/actions";
import { haptic } from "@/lib/haptics";
import { recentDaysAlmaty, PAYMENT_DATE_MAX_DAYS_BACK } from "@/lib/timezone";

// Сегодня первым, дальше назад по дням: «Сегодня, 05.10», «Вчера, 04.10», «сб, 03.10»…
function paymentDayOptions() {
  return recentDaysAlmaty(PAYMENT_DATE_MAX_DAYS_BACK + 1)
    .reverse()
    .map((d, i) => ({
      key: d.key,
      label:
        i === 0 ? `Сегодня, ${d.label}` : i === 1 ? `Вчера, ${d.label}` : `${d.weekday}, ${d.label}`,
    }));
}

export default function RevenueRequestForm({ open, onOpenChange, multiplier = 1, monthKzt = 0 }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setOpen = onOpenChange;
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);
  const [error, setError] = useState("");
  // Пусто = сегодня. Список дат строим при открытии формы, а не при
  // рендере сервера, — чтобы «сегодня» было по часам на момент заявки.
  const [paymentDay, setPaymentDay] = useState("");
  const [dayOptions, setDayOptions] = useState([]);
  const [clientName, setClientName] = useState("");
  const [productKind, setProductKind] = useState("");
  const [payKind, setPayKind] = useState("");
  const [isFinalPart, setIsFinalPart] = useState(false);

  // Список дат готовим при открытии формы.
  useEffect(() => {
    if (!open) return;
    setDayOptions(paymentDayOptions());
  }, [open]);

  // Пока форма открыта, страница под ней не прокручивается.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Та же формула, что при одобрении: шкала месяца и личный множитель.
  // Дата оплаты может быть в прошлом месяце — тогда это лишь прикидка.
  const coins = amount ? tieredRevenueCoins(Number(amount), multiplier, monthKzt) : 0;

  function submit(confirmDuplicate) {
    startTransition(async () => {
      const res = await submitRevenueRequest(
        Number(amount),
        comment,
        receiptConfirmed,
        paymentDay || undefined,
        { clientName, productKind, payKind, isFinalPart, confirmDuplicate }
      );

      if (res.duplicate) {
        haptic.error();
        if (window.confirm("Похоже, такая оплата уже внесена. Всё равно добавить?")) {
          submit(true);
        }
        return;
      }

      if (res.error) {
        setError(res.error);
        haptic.error();
        return;
      }

      haptic.success();

      setAmount("");
      setComment("");
      setReceiptConfirmed(false);
      setPaymentDay("");
      setClientName("");
      setProductKind("");
      setPayKind("");
      setIsFinalPart(false);
      setOpen(false);
      router.refresh();
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Введите корректную сумму");
      haptic.error();
      return;
    }

    if (!receiptConfirmed) {
      setError("Подтверди, что отправил чек в группу");
      haptic.error();
      return;
    }

    if (clientName.trim().length < 2) {
      setError("Укажи ФИО клиента");
      haptic.error();
      return;
    }
    if (!productKind) {
      setError("Выбери продукт: курс или интенсив / МК");
      haptic.error();
      return;
    }
    if (!payKind) {
      setError("Выбери вид оплаты: целиком или часть");
      haptic.error();
      return;
    }

    submit(false);
  }

  if (!open || typeof document === "undefined") return null;

  const segBtn = (active) =>
    `flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
      active
        ? "border-acid-400 bg-acid-400/15 text-acid-400"
        : "border-dark-600 bg-dark-700 text-gray-300"
    }`;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60" onClick={() => setOpen(false)}>
    <form
      onSubmit={handleSubmit}
      onClick={(e) => e.stopPropagation()}
      className="bg-dark-800 border border-dark-600 rounded-t-2xl p-5 space-y-4 w-full max-w-lg max-h-[92vh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center justify-between">
        <p className="font-semibold">Новая заявка</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-gray-500 text-sm"
        >
          Отмена
        </button>
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
          enterKeyHint="next"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-acid-400"
          placeholder="Фамилия Имя"
        />
        <p className="text-xs text-gray-500 mt-1">
          Достаточно имени, фамилия желательна. Без телефонов.
        </p>
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
        <p className="mt-1.5 text-xs text-gray-500 leading-snug">
          <span className="text-gray-400">Курс:</span> основной продукт, полный курс обучения.{" "}
          <span className="text-gray-400">Интенсив / МК:</span> короткий формат, интенсив или мастер-класс
          (это одно и то же).
        </p>
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
        <p className="mt-1.5 text-xs text-gray-500 leading-snug">
          <span className="text-gray-400">Целиком:</span> клиент оплатил всю сумму одним платежом.{" "}
          <span className="text-gray-400">Часть:</span> клиент платит по частям (предоплата, транш или
          доплата), каждый платёж вносится отдельной заявкой, на последнем поставь галочку.
        </p>
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
        <label className="block text-sm text-gray-400 mb-1">
          Сумма выручки, ₸
        </label>
        <input
          type="number"
          inputMode="numeric"
          required
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-acid-400"
          placeholder="560000"
        />
        {amount > 0 && (
          // В поле число без пробелов: 5600000 и 560000 легко перепутать.
          // Показываем ту же сумму с разрядами — лишний ноль сразу виден.
          <p className="text-xs mt-1">
            <span className="text-white font-semibold tabular-nums">
              {Math.round(Number(amount)).toLocaleString("ru-RU")} ₸
            </span>
            <span className="text-acid-400">
              {" "}
              ≈ {formatCoins(coins)} после одобрения
            </span>
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Дата оплаты
        </label>
        <select
          value={paymentDay}
          onChange={(e) => setPaymentDay(e.target.value)}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-acid-400"
        >
          {dayOptions.map((d, i) => (
            <option key={d.key} value={i === 0 ? "" : d.key}>
              {d.label}
            </option>
          ))}
        </select>
        {paymentDay && (
          <p className="text-xs text-gray-500 mt-1">
            В рейтинге оплата встанет на этот день
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Комментарий
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-acid-400"
          placeholder="Номер сделки и т.д."
        />
      </div>

      <label className="flex items-start gap-3 bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={receiptConfirmed}
          onChange={(e) => setReceiptConfirmed(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-sm text-gray-300">
          Я отправил чек в Telegram-группу
        </span>
      </label>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-acid-400 text-black font-bold rounded-lg py-3 hover:bg-acid-500 transition disabled:opacity-50"
      >
        {isPending ? "Отправляем..." : "Отправить на подтверждение"}
      </button>
    </form>
    </div>,
    document.body
  );
}
