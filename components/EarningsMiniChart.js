// Компактный график заработка за последние N дней — раньше был отдельным
// экраном «Моя динамика» (11 человек за месяц), теперь блок под балансом.
export default function EarningsMiniChart({ series }) {
  const values = series.map((s) => s.value);
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(...values, 1);

  if (total === 0) return null;

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">
          Заработок за {series.length} дней
        </p>
        <p className="text-sm font-bold text-acid-400 tabular-nums">
          {total.toLocaleString("ru-RU")}
        </p>
      </div>
      <div className="flex justify-between gap-1">
        {series.map((s) => {
          const h = s.value > 0 ? Math.max(10, (s.value / max) * 100) : 0;
          return (
            <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full h-10 flex items-end">
                <div
                  className="w-full rounded-t bg-acid-400/60"
                  style={{ height: `${h}%` }}
                />
              </div>
              <span className="text-[9px] text-gray-600 leading-tight">
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
