import Link from "next/link";
import Icon from "@/components/Icon";
import { formatCoins } from "@/lib/plural";
import { formatDateTimeAlmaty } from "@/lib/timezone";

const when = (v) => formatDateTimeAlmaty(v).replace(/\.\d{4},/, ",");
const DAY = 86400000;

// Турнир на главном экране: пока идёт запись — «Участвовать», во время
// игры — «Следить за игрой» и свой матч, после финала сутки висит победитель.
export default function TournamentHomeCard({ t, canJoin }) {
  if (!t) return null;
  const page = `/mop/games/tournament/${t.id}`;
  const pot = Number(t.pot || 0).toLocaleString("ru-RU");

  if (t.status === "finished") {
    // Карточку с итогами держим сутки, потом главный экран снова про работу.
    if (!t.finished_at || Date.now() - new Date(t.finished_at).getTime() > DAY) return null;
    return (
      <Link
        href={page}
        className="flex items-center gap-3.5 rounded-2xl border border-acid-400/40 bg-gradient-to-br from-acid-400/15 to-dark-800 p-4 active:opacity-80 transition"
      >
        <span className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-acid-400 text-black">
          <Icon name="trophy" className="w-6 h-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-gray-400">{t.title} · итоги</span>
          <span className="block font-bold truncate">Победитель: {t.winnerName ?? "определён"}</span>
          {t.pot > 0 && <span className="block text-xs text-gray-500">забирает {formatCoins(t.pot)}</span>}
        </span>
        <Icon name="chevronRight" className="w-4 h-4 shrink-0 text-gray-600" />
      </Link>
    );
  }

  if (t.status === "registration") {
    return (
      <div className="rounded-2xl border border-acid-400/40 bg-gradient-to-br from-acid-400/15 via-dark-800 to-dark-800 p-4 space-y-3">
        <Link href={page} className="flex items-center gap-3.5">
          <span className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-acid-400 text-black">
            <Icon name="trophy" className="w-6 h-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="font-bold truncate">{t.title}</span>
              <span className="shrink-0 rounded-full bg-acid-400 text-black text-[10px] font-bold px-2 py-0.5">Запись</span>
            </span>
            <span className="block text-xs text-gray-500">
              Clash Royale · записались {t.players}
              {t.registration_ends_at ? ` · до ${when(t.registration_ends_at)}` : ""}
            </span>
          </span>
        </Link>
        <div>
          <p className="font-display font-bold text-3xl text-acid-400 tabular-nums leading-none">
            {pot} <span className="text-sm font-sans font-normal text-gray-400">коинов в банке</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">Всё забирает победитель</p>
        </div>
        {t.joined ? (
          <Link
            href={page}
            className="flex items-center justify-center gap-2 rounded-xl border border-acid-400/40 py-2.5 text-sm font-semibold text-acid-400"
          >
            <Icon name="check" className="w-4 h-4" />
            Ты в турнире
          </Link>
        ) : (
          <Link
            href={page}
            className={`block text-center rounded-xl py-3 font-bold ${
              canJoin ? "bg-acid-400 text-black" : "border border-dark-600 text-gray-300 text-sm"
            }`}
          >
            {canJoin ? (t.entry_fee > 0 ? `Участвовать за ${formatCoins(t.entry_fee)}` : "Участвовать") : "Посмотреть турнир"}
          </Link>
        )}
      </div>
    );
  }

  if (t.status !== "running") return null;
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br from-acid-400/15 via-dark-800 to-dark-800 p-4 space-y-3 ${
        t.waitingMe ? "border-acid-400" : "border-acid-400/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-acid-400">
            <span className="w-1.5 h-1.5 rounded-full bg-acid-400 animate-pulse" />
            Турнир идёт
          </p>
          <p className="font-bold truncate mt-0.5">{t.title}</p>
          <p className="text-xs text-gray-500">Clash Royale · игроков {t.players}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-gray-500">Банк</p>
          <p className="font-display font-bold text-2xl text-acid-400 tabular-nums leading-none">{pot}</p>
        </div>
      </div>
      {t.waitingMe && <p className="text-sm text-gray-200">Соперник отметил итог матча и ждёт твоего ответа.</p>}
      <div className={`grid gap-2 ${t.joined ? "grid-cols-2" : "grid-cols-1"}`}>
        <Link
          href={`${page}/live`}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold ${
            t.waitingMe ? "border border-dark-600 text-gray-300" : "bg-acid-400 text-black"
          }`}
        >
          <Icon name="eye" className="w-4 h-4" />
          Следить за игрой
        </Link>
        {t.joined && (
          <Link
            href={page}
            className={`flex items-center justify-center rounded-xl py-2.5 text-sm font-bold ${
              t.waitingMe ? "bg-acid-400 text-black" : "border border-dark-600 text-gray-300"
            }`}
          >
            {t.waitingMe ? "Ответить" : "Мои матчи"}
          </Link>
        )}
      </div>
    </div>
  );
}
