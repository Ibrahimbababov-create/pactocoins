// Витрина призов за топ рейтинга. Показывается на экране рейтинга,
// чтобы люди видели, за что борются.
const MEDALS = ["🥇", "🥈", "🥉"];

function Row({ cfg }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-3 min-w-0">
        {cfg.prizes.map((p, i) => (
          <span key={i} className="tabular-nums whitespace-nowrap">
            <span className="mr-0.5">{MEDALS[i]}</span>
            <span className="font-bold text-acid-400">
              +{p.toLocaleString("ru-RU")}
            </span>
          </span>
        ))}
      </div>
      <span className="text-xs text-gray-500 shrink-0">
        от {cfg.min.toLocaleString("ru-RU")}
      </span>
    </div>
  );
}

export default function PrizeBoard({ weekly, monthly }) {
  return (
    <div className="rounded-2xl border border-acid-400/20 bg-gradient-to-br from-[#18220b] to-dark-800 p-4 space-y-3">
      <p className="text-xs text-gray-400 uppercase tracking-wider">
        🏆 Призы за топ рейтинга
      </p>
      <div className="space-y-2">
        <div>
          <p className="text-xs text-gray-500 mb-1">За неделю</p>
          <Row cfg={weekly} />
        </div>
        <div className="pt-2 border-t border-white/10">
          <p className="text-xs text-gray-500 mb-1">За месяц</p>
          <Row cfg={monthly} />
        </div>
      </div>
      <p className="text-[11px] text-gray-600 leading-snug">
        Начисляется отдельно, на рейтинг не влияет. «от N» — минимум coins за
        период, чтобы попасть в призы.
      </p>
    </div>
  );
}
