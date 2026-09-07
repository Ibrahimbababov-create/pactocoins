"use client";

import { useState, useTransition } from "react";
import { setOnboardingDayDone } from "@/app/mop/actions";
import { ONBOARDING_TYPES } from "@/lib/onboardingDays";

function ResourceRow({ item }) {
  const icon = ONBOARDING_TYPES[item.type]?.icon ?? "🔗";

  if (item.type === "text" || !item.url) {
    return (
      <div className="rounded-xl bg-dark-800 border border-dark-600 p-3">
        <p className="text-sm font-semibold text-gray-200">
          {icon} {item.title}
        </p>
        {item.body && (
          <p className="text-sm text-gray-400 whitespace-pre-line mt-1.5 leading-relaxed">
            {item.body}
          </p>
        )}
      </div>
    );
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl bg-dark-800 border border-dark-600 p-3 hover:border-acid-400/50 transition"
    >
      <p className="text-sm font-semibold text-gray-100">
        {icon} {item.title} <span className="text-acid-400">↗</span>
      </p>
      {item.body && (
        <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">
          {item.body}
        </p>
      )}
    </a>
  );
}

function DayBlock({ day, done, open, onToggleOpen, onToggleDone, pending }) {
  return (
    <div className="rounded-2xl border border-dark-600 overflow-hidden">
      <button
        type="button"
        onClick={onToggleOpen}
        className="w-full flex items-center gap-3 px-4 py-3 bg-dark-800 hover:bg-dark-700 transition text-left"
      >
        <span
          className={`w-6 h-6 shrink-0 rounded-full border flex items-center justify-center text-xs font-bold ${
            done
              ? "bg-acid-400 border-acid-400 text-black"
              : "border-gray-600 text-gray-500"
          }`}
        >
          {done ? "✓" : day.day}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-sm">День {day.day} · {day.title}</span>
          <span className="block text-xs text-gray-500">{day.subtitle}</span>
        </span>
        <span className="text-gray-500 text-lg shrink-0">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="p-4 space-y-4 bg-dark-900/40">
          {day.sections.length === 0 && (
            <p className="text-sm text-gray-500">
              Материалы этого дня скоро появятся — их добавляют админ и твой РОП.
            </p>
          )}
          {day.sections.map((section) => (
            <div key={section.name} className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-gray-500">
                {section.name}
              </p>
              {section.items.map((item) => (
                <ResourceRow key={item.id} item={item} />
              ))}
            </div>
          ))}

          <button
            type="button"
            onClick={onToggleDone}
            disabled={pending}
            className={`w-full rounded-xl py-2.5 text-sm font-bold transition ${
              done
                ? "bg-acid-400/10 text-acid-400 border border-acid-400/30"
                : "bg-acid-400 text-black"
            }`}
          >
            {done ? "✓ День пройден — снять отметку" : `Я прошёл день ${day.day}`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function OnboardingTrainee({ days, progress, ropName }) {
  const [isPending, startTransition] = useTransition();
  const doneMap = {
    1: !!progress?.onboarding_day1_done,
    2: !!progress?.onboarding_day2_done,
    3: !!progress?.onboarding_day3_done,
  };
  // По умолчанию открыт первый непройденный день.
  const firstOpen = [1, 2, 3].find((d) => !doneMap[d]) ?? 1;
  const [openDay, setOpenDay] = useState(firstOpen);

  function toggleDone(dayNum) {
    startTransition(async () => {
      await setOnboardingDayDone(dayNum, !doneMap[dayNum]);
    });
  }

  const doneCount = [1, 2, 3].filter((d) => doneMap[d]).length;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-sky-500/10 to-dark-800 border border-sky-500/30 rounded-2xl p-5 space-y-2">
        <p className="text-lg font-bold text-sky-300">🎓 Обучение стажёра</p>
        <p className="text-sm text-gray-400">
          Три дня материалов: язык команды и регламент, продажи и CRM,
          квалификация и возражения. Отмечай день пройденным, когда разобрался.
        </p>
        <p className="text-sm text-gray-400">
          Стажировка закрывается автоматически после{" "}
          <b className="text-white">первой одобренной оплаты</b> — тогда ты
          становишься МОПом 1 уровня.
        </p>
        <p className="text-xs text-gray-500 pt-1">
          {ropName
            ? `Твой руководитель: ${ropName}`
            : "Руководитель не выбран — выбери его в Настройках."}
          {" · "}
          Пройдено дней: {doneCount}/3
        </p>
      </div>

      {days.map((day) => (
        <DayBlock
          key={day.day}
          day={day}
          done={doneMap[day.day]}
          open={openDay === day.day}
          onToggleOpen={() =>
            setOpenDay((cur) => (cur === day.day ? null : day.day))
          }
          onToggleDone={() => toggleDone(day.day)}
          pending={isPending}
        />
      ))}
    </div>
  );
}
