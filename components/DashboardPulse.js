import Link from "next/link";
import Icon from "@/components/Icon";

const kzt = (n) => `${(Number(n) || 0).toLocaleString("ru-RU")} ₸`;

// «Где я в рейтинге недели» — главный стимул, раньше за ним надо было
// уходить во вкладку «Рейтинг». Тут — место, сколько до следующего и до приза.
export function WeekPlaceCard({ data }) {
  if (!data) return null;

  if (!data.place) {
    return (
      <Link
        href="/mop/rating"
        className="flex items-center gap-3 bg-dark-800 border border-dark-600 rounded-2xl p-4"
      >
        <Icon name="award" className="w-8 h-8 text-gray-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">На этой неделе ты ещё не в рейтинге</p>
          <p className="text-sm text-gray-400 mt-0.5">
            {data.ranked > 0
              ? `Первая подтверждённая оплата сразу поставит тебя в таблицу — там уже ${data.ranked}`
              : "Пока ни у кого нет оплат. Первая сделка недели — сразу первое место"}
          </p>
        </div>
        <Icon name="chevronRight" className="w-5 h-5 text-gray-600 shrink-0" />
      </Link>
    );
  }

  const toPrize = data.prizeMin - data.value;

  return (
    <Link
      href="/mop/rating"
      className="block bg-dark-800 border border-dark-600 rounded-2xl p-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Рейтинг недели</p>
        <Icon name="chevronRight" className="w-4 h-4 text-gray-600" />
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={`font-display text-3xl font-bold tabular-nums ${
            data.place <= 3 ? "text-acid-400" : ""
          }`}
        >
          {data.place} место
        </span>
        <span className="text-sm text-gray-500">из {data.ranked}</span>
      </div>
      <p className="text-sm text-gray-300 mt-1">
        {data.place === 1
          ? data.leadOver != null
            ? `Ты лидер. Отрыв от второго — ${kzt(data.leadOver)}`
            : "Ты лидер недели"
          : `До ${data.place - 1}-го места — ${kzt(data.gapUp)}`}
      </p>
      {data.prize != null ? (
        <p className="text-xs text-acid-400 mt-2">
          Сейчас ты в призовой тройке и выше порога
        </p>
      ) : toPrize > 0 ? (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-dark-600 overflow-hidden">
            <div
              className="h-full rounded-full bg-acid-400/70"
              style={{ width: `${Math.min(100, (data.value / data.prizeMin) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            До порога приза недели — {kzt(toPrize)}
          </p>
        </div>
      ) : null}
    </Link>
  );
}

// Для РОПа вместо заглушки «скоро новинка» — живая сводка по команде.
export function TeamMonthCard({ data }) {
  if (!data) return null;

  if (data.size === 0) {
    return (
      <Link
        href="/mop/team"
        className="flex items-center gap-3 bg-dark-800 border border-dark-600 rounded-2xl p-4"
      >
        <Icon name="users" className="w-8 h-8 text-gray-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">В команде пока никого</p>
          <p className="text-sm text-gray-400 mt-0.5">Добавь своих МОПов, чтобы видеть их выручку</p>
        </div>
        <Icon name="chevronRight" className="w-5 h-5 text-gray-600 shrink-0" />
      </Link>
    );
  }

  return (
    <Link
      href="/mop/team"
      className="block bg-dark-800 border border-dark-600 rounded-2xl p-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Твоя команда · {data.monthLabel}</p>
        <Icon name="chevronRight" className="w-4 h-4 text-gray-600" />
      </div>
      <p className="font-display text-3xl font-bold tabular-nums mt-1">
        {kzt(data.total)}
      </p>
      <p className="text-sm text-gray-400 mt-1">
        Оплаты есть у {data.withPayments} из {data.size}
      </p>
      {data.best && (
        <p className="text-xs text-gray-500 mt-2">
          Лучший сейчас: <span className="text-gray-300">{data.best.name}</span> —{" "}
          {kzt(data.best.value)}
        </p>
      )}
    </Link>
  );
}

const short = (n) => {
  const v = Math.max(0, Number(n) || 0);
  if (v >= 1000000) return `${(Math.ceil(v / 100000) / 10).toLocaleString("ru-RU")} млн ₸`;
  return `${Math.ceil(v / 1000).toLocaleString("ru-RU")} тыс ₸`;
};

// Шкала коинов: чем больше выручки за месяц, тем больше коинов за каждую
// следующую тысячу. Карточка показывает, на каком ты «этаже» и сколько до
// следующего — это и есть повод дожать ещё одну сделку.
export function MonthTierCard({ data }) {
  if (!data) return null;
  const { rate, next, value, monthLabel } = data;
  const pct = next ? Math.min(100, Math.round((value / next.from) * 100)) : 100;

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Ставка за {monthLabel}</p>
        <p className="text-xs text-gray-500 tabular-nums">{kzt(value)}</p>
      </div>
      <p className="mt-1 flex items-baseline gap-2">
        <span
          className={`font-display text-3xl font-bold tabular-nums ${rate > 1 ? "text-acid-400" : ""}`}
        >
          {rate} {rate === 1 ? "коин" : "коина"}
        </span>
        <span className="text-sm text-gray-500">за 1000 ₸</span>
      </p>
      {next ? (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-dark-600 overflow-hidden">
            <div className="h-full rounded-full bg-acid-400/70" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Ещё {short(next.left)} — и каждая 1000 ₸ сверху даст {next.rate} коина
          </p>
        </div>
      ) : (
        <p className="text-xs text-acid-400 mt-2">Максимальная ставка месяца 🔥</p>
      )}
    </div>
  );
}
