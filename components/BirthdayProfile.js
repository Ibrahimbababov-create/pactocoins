"use client";

import { useState, useTransition } from "react";
import { setMyBirthday } from "@/app/mop/actions";

export default function BirthdayProfile({ birthday, variant = "inline" }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);
  const [savedDate, setSavedDate] = useState(birthday);

  function handleSubmit(formData) {
    const date = formData.get("birthday");
    startTransition(async () => {
      const res = await setMyBirthday(formData);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setSavedDate(date);
      }
    });
  }

  // Крупная подсказка вверху дашборда: показываем только тем, кто ещё
  // не указал ДР. Как только указал — карточка пропадает.
  if (variant === "prompt") {
    if (savedDate) return null;

    return (
      <form
        action={handleSubmit}
        className="bg-gradient-to-br from-acid-400/10 to-dark-800 border border-acid-400/40 rounded-2xl p-5 space-y-3"
      >
        <p className="text-lg font-bold">🎂 Укажи свой день рождения</p>
        <p className="text-sm text-gray-400">
          В этот день тебе автоматически начислят 3000 coins. Указать можно
          один раз — потом поменять сможет только админ.
        </p>

        {message && (
          <div className="rounded-xl p-3 text-sm text-center bg-red-500/10 text-red-400">
            {message.text}
          </div>
        )}

        <input
          type="date"
          name="birthday"
          required
          className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
        />

        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input type="checkbox" name="already_gifted" className="shrink-0" />
          Мне уже дарили подарок на ДР в этом году
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-acid-400 text-black font-bold rounded-lg py-3 text-sm disabled:opacity-50"
        >
          {isPending ? "Сохраняем..." : "Сохранить"}
        </button>
      </form>
    );
  }

  if (savedDate) {
    const displayDate = new Date(savedDate).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
    });

    return (
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 flex items-center justify-between">
        <p className="text-sm text-gray-400">🎂 Твой день рождения</p>
        <p className="text-sm font-semibold">{displayDate}</p>
      </div>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3"
    >
      <p className="text-sm text-gray-400">
        🎂 Укажи день рождения — в этот день тебе автоматически начислят 3000
        coins. Указать можно только один раз, поменять потом сможет только
        админ.
      </p>

      {message && (
        <div className="rounded-xl p-3 text-sm text-center bg-red-500/10 text-red-400">
          {message.text}
        </div>
      )}

      <input
        type="date"
        name="birthday"
        required
        className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-white"
      />

      <label className="flex items-center gap-2 text-xs text-gray-500">
        <input type="checkbox" name="already_gifted" className="shrink-0" />
        Мне уже дарили подарок на ДР в этом году
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-acid-400 text-black font-bold rounded-lg py-2.5 text-sm disabled:opacity-50"
      >
        {isPending ? "Сохраняем..." : "Сохранить"}
      </button>
    </form>
  );
}
