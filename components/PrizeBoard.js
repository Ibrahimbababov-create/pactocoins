// Компактная строка с призом за топ выбранного периода. Показывается
// на экране рейтинга под переключателем Неделя/Месяц.
const MEDALS = ["🥇", "🥈", "🥉"];

export default function PrizeBoard({ cfg }) {
  if (!cfg) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-acid-400/20 bg-acid-400/[0.06] px-3 py-2">
      <span className="text-[11px] uppercase tracking-wide text-gray-400">
        🏆 Приз за топ
      </span>
      {cfg.prizes.map((p, i) => (
        <span key={i} className="text-sm tabular-nums whitespace-nowrap">
          {MEDALS[i]}{" "}
          <span className="font-bold text-acid-400">
            +{p.toLocaleString("ru-RU")}
          </span>
        </span>
      ))}
      <span className="ml-auto text-[11px] text-gray-500 whitespace-nowrap">
        от {cfg.min.toLocaleString("ru-RU")} · мимо рейтинга
      </span>
    </div>
  );
}
