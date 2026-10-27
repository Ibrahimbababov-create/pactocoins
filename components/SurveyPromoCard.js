import Link from "next/link";
import Icon from "@/components/Icon";
import DismissibleCard from "@/components/DismissibleCard";
import { chipsNom, plural } from "@/lib/plural";
import { surveyDaysLeft } from "@/lib/survey";
import { SURVEY_ID, SURVEY_REWARD_CHIPS, SURVEY_MINUTES } from "@/lib/surveyQuestions";

// Карточка «Опрос команды» на главной и в «Ещё». На главной её можно
// закрыть крестиком, в «Ещё» она остаётся.
export default function SurveyPromoCard({ dismissible = false, endsAt = null }) {
  const left = surveyDaysLeft(endsAt);
  const card = (
    <Link
      href="/mop/survey"
      className={`flex items-center gap-3.5 rounded-2xl border border-acid-400/40 bg-gradient-to-br from-acid-400/15 to-dark-800 py-4 pl-4 active:opacity-80 transition ${
        dismissible ? "pr-11" : "pr-4"
      }`}
    >
      <span className="flex items-center justify-center w-12 h-12 shrink-0 rounded-xl bg-acid-400 text-black">
        <Icon name="sparkle" className="w-6 h-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">Опрос команды</span>
        <span className="block text-sm text-gray-400">
          {SURVEY_MINUTES} минуты, +{SURVEY_REWARD_CHIPS} {chipsNom(SURVEY_REWARD_CHIPS)} за ответы
        </span>
        {left != null && (
          <span className="block text-xs text-gray-500 mt-0.5">
            {left <= 1 ? "Последний день" : `Осталось ${left} ${plural(left, "день", "дня", "дней")}`}
          </span>
        )}
      </span>
      {!dismissible && <Icon name="chevronRight" className="w-4 h-4 shrink-0 text-gray-600" />}
    </Link>
  );
  return dismissible ? <DismissibleCard storageKey={`survey-${SURVEY_ID}`}>{card}</DismissibleCard> : card;
}
