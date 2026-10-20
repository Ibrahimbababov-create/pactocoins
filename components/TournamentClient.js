"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { formatCoins } from "@/lib/plural";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import { roundLabel, leagueStandings } from "@/lib/tournamentRounds";
import { MODE_NAME, MODE_LINE, MODE_HOW } from "@/lib/clashMode";
import {
  joinTournament,
  saveClashProfile,
  withdrawFromTournament,
  reportMatch,
  confirmMatch,
  disputeMatch,
} from "@/app/mop/games/tournamentActions";

const STATUS = {
  draft: "Черновик",
  registration: "Идёт запись",
  seeding: "Собираем сетку",
  running: "Идёт турнир",
  finished: "Завершён",
  cancelled: "Отменён",
};

// «18.10, 20:00» — год на экране не нужен.
const when = (v) => formatDateTimeAlmaty(v).replace(/\.\d{4},/, ",");

// Имя человека и его ник в игре рядом. В офисе зовут по имени, а над
// ареной в бою видно ник: без связки непонятно, с кем ты сел играть.
function Who({ p, right = false, strong = false, dim = false, me = false }) {
  const nick = p?.inGame;
  return (
    <span className={`min-w-0 flex-1 ${right ? "text-right" : ""}`}>
      <span className={`block truncate text-sm ${strong ? "font-bold" : ""} ${dim ? "text-gray-500" : ""}`}>
        {p?.name ?? "Игрок"}
        {me && <span className="ml-1 text-[10px] font-normal text-acid-400">ты</span>}
      </span>
      {nick && <span className="block truncate text-[11px] text-gray-500">{nick}</span>}
    </span>
  );
}

// Режим боя: его путают чаще всего, поэтому пишем прямо, а не в правилах.
function ModeNote({ className = "" }) {
  return (
    <div className={`rounded-xl border border-acid-400/25 bg-acid-400/[0.06] px-3.5 py-2.5 ${className}`}>
      <p className="text-sm font-semibold text-acid-400">{MODE_NAME}</p>
      <p className="mt-0.5 text-xs text-gray-400">{MODE_HOW}</p>
    </div>
  );
}

// Во время турнира шапка компактная: главное на экране — твой матч.
function HeroCompact({ t, players, stage }) {
  return (
    <div className="rounded-2xl border border-acid-400/30 bg-gradient-to-br from-acid-400/15 via-dark-800 to-dark-800">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-acid-400">
            <span className="w-1.5 h-1.5 rounded-full bg-acid-400 animate-pulse" />
            {t.format === "league" ? (stage === "league" ? "Идёт лига" : "Плей-офф") : "Идёт турнир"}
            {t.playoff_wins > 1 && stage === "playoff" ? ` · до ${t.playoff_wins} побед` : ""}
          </p>
          <p className="text-[11px] text-gray-500 mt-1 truncate">
            Взнос {Number(t.entry_fee || 0).toLocaleString("ru-RU")}
            {t.bonus_coins > 0 ? ` · Pacto +${Number(t.bonus_coins).toLocaleString("ru-RU")}` : ""} · игроков {players}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-gray-500">Банк</p>
          <p className="font-display font-bold text-2xl text-acid-400 tabular-nums leading-none">
            {Number(t.pot || 0).toLocaleString("ru-RU")}
          </p>
        </div>
      </div>
      <Link
        href={`/mop/games/tournament/${t.id}/live`}
        className="flex items-center gap-2 border-t border-acid-400/20 px-4 py-2 text-xs text-gray-300 active:opacity-70"
      >
        <Icon name="eye" className="w-4 h-4 text-acid-400" />
        <span className="flex-1">Смотреть игру онлайн: таблица, туры, кто когда нажал</span>
        <Icon name="chevronRight" className="w-3.5 h-3.5 text-gray-600" />
      </Link>
    </div>
  );
}

// Переключатель разделов страницы (матчи / таблица / сетка).
function Tabs({ value, onChange, items }) {
  return (
    <div className="grid gap-1 rounded-xl bg-dark-800 border border-dark-600 p-1" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onChange(it.key)}
          className={`rounded-lg py-2 text-sm font-semibold transition ${
            value === it.key ? "bg-acid-400 text-black" : "text-gray-400"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function Hero({ t, players, winnerName, stage }) {
  const live = t.status === "registration" || t.status === "running";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-acid-400/30 bg-gradient-to-br from-acid-400/15 via-dark-800 to-dark-800 p-5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            live ? "bg-acid-400/15 text-acid-400" : "bg-dark-700 text-gray-400"
          }`}
        >
          {live && <span className="w-1.5 h-1.5 rounded-full bg-acid-400 animate-pulse" />}
          {t.status === "running" && t.format === "league"
            ? stage === "league"
              ? "Идёт лига"
              : "Плей-офф"
            : (STATUS[t.status] ?? t.status)}
        </span>
        <span className="text-xs text-gray-500">Clash Royale · {MODE_NAME.toLowerCase()}</span>
      </div>

      {t.status === "finished" && winnerName ? (
        <div className="mt-4">
          <Icon name="trophy" className="w-9 h-9 text-acid-400" />
          <p className="text-sm text-gray-400 mt-2">Победитель</p>
          <p className="text-2xl font-display font-bold">{winnerName}</p>
          {t.pot > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              банк <b className="text-acid-400">{formatCoins(t.pot)}</b> у победителя
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-gray-400">Банк</p>
          <p className="text-4xl font-display font-bold text-acid-400 tabular-nums leading-tight">
            {Number(t.pot || 0).toLocaleString("ru-RU")}
          </p>
          <p className="text-sm text-gray-400">коинов забирает победитель</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-dark-900/50 py-2">
          <p className="text-[11px] text-gray-500">Взнос</p>
          <p className="text-sm font-semibold tabular-nums">{Number(t.entry_fee || 0).toLocaleString("ru-RU")}</p>
        </div>
        <div className="rounded-xl bg-dark-900/50 py-2">
          <p className="text-[11px] text-gray-500">От Pacto</p>
          <p className="text-sm font-semibold tabular-nums">{t.bonus_coins > 0 ? `+${Number(t.bonus_coins).toLocaleString("ru-RU")}` : "—"}</p>
        </div>
        <div className="rounded-xl bg-dark-900/50 py-2">
          <p className="text-[11px] text-gray-500">Игроков</p>
          <p className="text-sm font-semibold tabular-nums">
            {players}
            {t.max_players ? `/${t.max_players}` : ""}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-400">
        {t.format === "league"
          ? `Лига: каждый с каждым${t.league_ends_at ? ` до ${when(t.league_ends_at)}` : ""}, лучшие ${t.playoff_size ?? 4} в плей-офф`
          : "Сразу плей-офф: проиграл, значит выбыл"}
        {t.playoff_wins > 1 ? `. Плей-офф до ${t.playoff_wins} побед` : ""}
      </p>
      {t.status === "registration" && t.registration_ends_at && (
        <p className="mt-1 text-xs text-gray-400">Запись до {when(t.registration_ends_at)}</p>
      )}
    </div>
  );
}

// Для тех, кто впервые: что сделать до записи.
function HowToJoin({ t }) {
  if (t.status !== "registration") return null;
  const steps = [
    t.clan_tag
      ? `Вступи в клан ${t.clan_tag} в Clash Royale: вкладка «Клан» → поиск → вставь тег клана.`
      : "Добавь соперников в друзья в Clash Royale (клан пришлёт админ).",
    "Узнай свой тег: нажми на свой ник в игре, тег под ним, вида #2PYLQ8.",
    "Впиши ник и тег ниже, нажми «Участвовать». Когда запись закроется, бот пришлёт соперников.",
  ];
  return (
    <div className="rounded-2xl border border-dark-600 bg-dark-800 p-4">
      <p className="font-semibold">Как участвовать</p>
      <ol className="mt-2 space-y-2">
        {steps.map((text, i) => (
          <li key={i} className="flex gap-3 text-sm text-gray-300">
            <span className="flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-acid-400/15 text-acid-400 text-xs font-bold">
              {i + 1}
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
      <ModeNote className="mt-3" />
      {t.clan_tag && (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(t.clan_tag)}
          className="mt-3 text-xs text-gray-400 border border-dark-600 rounded-lg px-2.5 py-1.5"
        >
          Скопировать тег клана
        </button>
      )}
    </div>
  );
}

function JoinBlock({ t, me, viewer, pending, run }) {
  const [tag, setTag] = useState(viewer.clashTag);
  const [nick, setNick] = useState(viewer.clashName ?? "");
  if (t.status !== "registration") return null;
  if (viewer.isGuest) {
    return <p className="text-sm text-gray-500 text-center">В гостевом режиме участвовать нельзя.</p>;
  }
  if (me) {
    return (
      <div className="rounded-2xl border border-dark-600 bg-dark-800 p-4 flex items-center gap-3">
        <Icon name="check" className="w-6 h-6 text-acid-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Ты участвуешь</p>
          <p className="text-xs text-gray-500">Когда запись закроется, бот напишет, с кем ты играешь.</p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            window.confirm(t.entry_fee > 0 ? "Выйти из турнира? Взнос вернём на баланс." : "Выйти из турнира?") &&
            run(() => withdrawFromTournament(t.id))
          }
          className="shrink-0 text-xs text-gray-400 underline disabled:opacity-50"
        >
          Выйти
        </button>
      </div>
    );
  }
  const short = t.entry_fee > viewer.balance;
  return (
    <div className="rounded-2xl border border-dark-600 bg-dark-800 p-4 space-y-3">
      {/* Ник и тег — разные вещи: по тегу тебя добавят, по нику узнают в бою. */}
      <label className="block text-xs text-gray-500">
        Твой ник в Clash Royale
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          placeholder="как написано в игре"
          className="block w-full mt-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white"
        />
        <span className="block mt-1 text-gray-600">Его соперник видит над ареной в бою</span>
      </label>
      <label className="block text-xs text-gray-500">
        Твой тег в Clash Royale
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value.toUpperCase())}
          placeholder="#2PYLQ8"
          className="block w-full mt-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white uppercase"
        />
        <span className="block mt-1 text-gray-600">В игре: профиль, под ником</span>
      </label>
      <button
        type="button"
        disabled={pending || short || !tag.trim() || !nick.trim()}
        onClick={() =>
          window.confirm(
            t.entry_fee > 0
              ? `Записаться в турнир? ${formatCoins(t.entry_fee)} уйдут в общий банк. До старта можно выйти и вернуть взнос.`
              : "Записаться в турнир?"
          ) && run(() => joinTournament(t.id, tag, nick))
        }
        className="w-full bg-acid-400 text-black font-bold rounded-xl py-3 disabled:opacity-50"
      >
        {t.entry_fee > 0 ? `Участвовать за ${formatCoins(t.entry_fee)}` : "Участвовать"}
      </button>
      {short && (
        <p className="text-xs text-amber-400 text-center">
          На балансе {formatCoins(viewer.balance)}, на взнос не хватает.
        </p>
      )}
    </div>
  );
}

// Свой ник и тег. Кто записался раньше, чем мы стали спрашивать ник,
// дописывает здесь; здесь же чинят тег, если в него попал тег клана.
function MyNickCard({ t, me, viewer, pending, run }) {
  const savedNick = me?.clashName || viewer.clashName || "";
  const savedTag = viewer.clashTag || "";
  const [nick, setNick] = useState(savedNick);
  const [tag, setTag] = useState(savedTag);
  const [open, setOpen] = useState(!savedNick);
  useEffect(() => {
    if (savedNick) {
      setNick(savedNick);
      setTag(savedTag);
      setOpen(false);
    }
  }, [savedNick, savedTag]);
  if (!me || viewer.isGuest || ["finished", "cancelled"].includes(t.status)) return null;

  if (!open) {
    return (
      <div className="flex items-center gap-2 px-1 text-xs text-gray-500">
        <span className="min-w-0 truncate">
          Ты в игре: <b className="text-gray-300">{savedNick}</b>
          {savedTag ? <span className="tabular-nums"> · {savedTag}</span> : null}
        </span>
        <button type="button" onClick={() => setOpen(true)} className="shrink-0 underline">
          изменить
        </button>
      </div>
    );
  }
  return (
    <div className={`rounded-2xl border bg-dark-800 p-4 space-y-3 ${savedNick ? "border-dark-600" : "border-acid-400/50"}`}>
      <p className="font-semibold">{savedNick ? "Ник и тег в игре" : "Впиши свой ник в игре"}</p>
      {!savedNick && (
        <p className="text-xs text-gray-400">
          В бою над ареной видно ник, а не имя. Соперник ищет тебя именно по нему.
        </p>
      )}
      <label className="block text-xs text-gray-500">
        Ник
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          placeholder="как написано в игре"
          className="block w-full mt-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white"
        />
      </label>
      <label className="block text-xs text-gray-500">
        Тег
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value.toUpperCase())}
          placeholder="#2PYLQ8"
          className="block w-full mt-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white uppercase"
        />
        <span className="block mt-1 text-gray-600">Свой личный, в игре под ником. Не тег клана</span>
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !nick.trim()}
          onClick={() => run(() => saveClashProfile(t.id, nick, tag))}
          className="flex-1 bg-acid-400 text-black font-bold rounded-lg py-2.5 text-sm disabled:opacity-50"
        >
          Сохранить
        </button>
        {savedNick && (
          <button
            type="button"
            onClick={() => {
              setNick(savedNick);
              setTag(savedTag);
              setOpen(false);
            }}
            className="px-4 border border-dark-600 text-gray-400 rounded-lg py-2.5 text-sm"
          >
            Отмена
          </button>
        )}
      </div>
    </div>
  );
}

function MatchActions({ t, m, opp, viewer, pending, run, compact = false }) {
  const bigBtn = compact ? "rounded-lg py-2 text-xs" : "rounded-xl py-2.5 text-sm";
  // Серия плей-офф: приложение бои не считает, итог отмечают один раз.
  // Поэтому прямо на кнопке напоминаем, что отмечать нужно всю серию.
  const series = m.round > 0 && t.playoff_wins > 1 ? t.playoff_wins : 0;
  if (m.status === "ready") {
    return (
      <div className="space-y-2">
        {series > 0 && (
          <p className="text-xs text-amber-400">
            Серия до {series} побед. Отмечай итог, только когда кто-то выиграл {series} боя, а не после первого.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              window.confirm(
                series > 0
                  ? `Ты выиграл серию, ${series} боя? ${opp.name} получит запрос на подтверждение.`
                  : `Победа твоя? ${opp.name} получит запрос на подтверждение.`
              ) && run(() => reportMatch(m.id, "won"))
            }
            className={`bg-acid-400 text-black font-bold disabled:opacity-50 ${bigBtn}`}
          >
            {series > 0 ? "Серия моя" : "Моя победа"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              window.confirm(
                series > 0
                  ? `${opp.name} выиграл серию, ${series} боя? Это сразу засчитается.`
                  : `Победа за ${opp.name}? Это сразу засчитается.`
              ) && run(() => reportMatch(m.id, "lost"))
            }
            className={`border border-dark-600 text-gray-300 disabled:opacity-50 ${bigBtn}`}
          >
            {series > 0 ? "Серия за соперником" : "Победа соперника"}
          </button>
        </div>
      </div>
    );
  }
  if (m.status === "reported" && m.reported_by === viewer.id) {
    return (
      <p className="text-xs text-gray-400">
        Ждём подтверждения до {when(m.confirm_by)}, потом засчитаем сами.
      </p>
    );
  }
  if (m.status === "reported") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-300">
          {opp.name} сообщает о своей победе. Так и было?
        </p>
        {series > 0 && (
          <p className="text-xs text-amber-400">
            Серия до {series} побед: подтверждай только если он реально выиграл {series} боя. Если серия не доиграна,
            жми «это не так».
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => confirmMatch(m.id))}
            className={`bg-acid-400 text-black font-bold disabled:opacity-50 ${bigBtn}`}
          >
            Подтверждаю
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const note = window.prompt("Что было на самом деле? Админ увидит это и решит.");
              if (note !== null) run(() => disputeMatch(m.id, note));
            }}
            className={`border border-dark-600 text-gray-300 disabled:opacity-50 ${bigBtn}`}
          >
            Это не так
          </button>
        </div>
      </div>
    );
  }
  if (m.status === "disputed") return <p className="text-xs text-amber-400">Спор, решит админ.</p>;
  if (m.status === "done") {
    const won = m.winner_id === viewer.id;
    return <p className={`text-xs ${won ? "text-acid-400" : "text-gray-500"}`}>{won ? "Победа" : "Поражение"}</p>;
  }
  return null;
}

function MyMatch({ t, m, people, viewer, rounds, pending, run }) {
  if (!m || t.status !== "running") return null;
  const oppId = m.player_a === viewer.id ? m.player_b : m.player_a;
  const opp = oppId ? people[oppId] : null;
  const title = `Твой матч · ${roundLabel(m.round, rounds)}`;

  let body;
  if (m.status === "waiting" || !opp) {
    body = <p className="text-sm text-gray-400">Ждём, кто выйдет из соседнего матча. Бот напишет, когда станет известен соперник.</p>;
  } else {
    body = (
      <>
        {m.status === "ready" && (
          <p className="text-sm text-gray-400">
            {t.playoff_wins > 1 ? `Играйте до ${t.playoff_wins} побед` : "Сыграйте один дружеский бой"}
            {t.clan_tag ? ` в клане ${t.clan_tag}` : ""}, успеть до <b className="text-gray-200">{when(m.play_by)}</b>. Потом
            отметь итог.
          </p>
        )}
        <MatchActions t={t} m={m} opp={opp} viewer={viewer} pending={pending} run={run} />
      </>
    );
  }

  return (
    <div className="rounded-2xl border border-acid-400/40 bg-dark-800 p-4 space-y-3">
      <p className="text-xs text-acid-400 font-semibold">{title}</p>
      {opp && (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold truncate">{opp.name}</p>
            {opp.inGame && <p className="text-xs text-gray-400 truncate">в игре: {opp.inGame}</p>}
            {opp.tag && <p className="text-xs text-gray-500 tabular-nums">{opp.tag}</p>}
          </div>
          {opp.tag && (
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(opp.tag)}
              className="shrink-0 text-xs text-gray-400 border border-dark-600 rounded-lg px-2.5 py-1.5"
            >
              Скопировать тег
            </button>
          )}
        </div>
      )}
      {body}
    </div>
  );
}

function LeagueTable({ t, entries, matches, people, viewer, collapsed, bare = false }) {
  const table = leagueStandings(
    entries.map((e) => e.userId),
    matches
  );
  const cut = Math.min(t.playoff_size ?? 4, table.length);
  const league = matches.filter((m) => m.round === 0 && m.status !== "void");
  const played = league.filter((m) => m.status === "done").length;
  const total = league.length;
  const perPlayer = Math.max(1, table.length - 1);

  const row = (r) => {
    const inZone = r.place <= cut;
    const mine = r.userId === viewer.id;
    const medal = r.place <= 3 && r.wins > 0;
    return (
      <div
        key={r.userId}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl ${
          mine ? "ring-1 ring-acid-400/60" : ""
        } ${inZone ? "bg-acid-400/[0.07]" : ""}`}
      >
        <span
          className={`flex items-center justify-center w-7 h-7 shrink-0 rounded-full text-xs font-bold tabular-nums ${
            medal
              ? r.place === 1
                ? "bg-acid-400 text-black"
                : "bg-acid-400/30 text-acid-400"
              : inZone
                ? "bg-dark-700 text-gray-200"
                : "bg-dark-700/60 text-gray-500"
          }`}
        >
          {r.place}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${mine ? "text-acid-400 font-semibold" : inZone ? "font-semibold" : "text-gray-400"}`}>
            {people[r.userId]?.name ?? "Игрок"}
            {mine && <span className="ml-1.5 text-[10px] font-normal">ты</span>}
            {people[r.userId]?.inGame && (
              <span className="ml-1.5 text-[10px] font-normal text-gray-500">{people[r.userId].inGame}</span>
            )}
          </span>
          {/* сколько из своих матчей уже сыграно и выиграно */}
          <span className="mt-1 flex h-1 rounded-full bg-dark-700 overflow-hidden">
            <span className="bg-acid-400" style={{ width: `${(r.wins / perPlayer) * 100}%` }} />
            <span className="bg-gray-600" style={{ width: `${(r.losses / perPlayer) * 100}%` }} />
          </span>
        </span>
        <span className="shrink-0 w-10 text-center text-xs tabular-nums text-gray-400">
          {r.played}
          <span className="text-gray-600">/{perPlayer}</span>
        </span>
        <span className="shrink-0 w-8 text-right">
          <span className="block font-display font-bold tabular-nums text-base leading-none">{r.wins}</span>
          <span className="block text-[10px] text-gray-500 mt-0.5 tabular-nums">
            {r.wins}–{r.losses}
          </span>
        </span>
      </div>
    );
  };

  const body = (
    <div className="rounded-2xl border border-dark-600 bg-dark-800 p-2">
      <div className="px-2 pt-1.5 pb-3">
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>
            Сыграно {played} из {total}
          </span>
          <span className="flex gap-3">
            <span className="w-10 text-center">игр</span>
            <span className="w-8 text-right">побед</span>
          </span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-dark-700 overflow-hidden">
          <div className="h-full bg-acid-400 rounded-full" style={{ width: total ? `${(played / total) * 100}%` : 0 }} />
        </div>
      </div>
      <div className="space-y-1">{table.slice(0, cut).map(row)}</div>
      {cut < table.length && (
        <>
          <div className="flex items-center gap-2 px-2 py-2 text-[10px] font-semibold text-acid-400">
            <span className="h-px flex-1 bg-acid-400/40" />
            выше черты — в плей-офф
            <span className="h-px flex-1 bg-acid-400/40" />
          </div>
          <div className="space-y-1">{table.slice(cut).map(row)}</div>
        </>
      )}
    </div>
  );
  if (bare) return body;
  if (collapsed) {
    return (
      <details className="space-y-2">
        <summary className="text-sm text-gray-500 px-1 cursor-pointer">Таблица лиги</summary>
        {body}
      </details>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500 px-1">Таблица лиги</p>
      {body}
    </div>
  );
}

// Порядок своих матчей лиги: сначала ждущие твоего ответа, потом по турам.
function leagueOrder(list, viewer) {
  const byTour = (a, b) => (a.tour ?? a.slot) - (b.tour ?? b.slot);
  const open = list.filter((m) => m.status !== "done").sort(byTour);
  const done = list.filter((m) => m.status === "done").sort(byTour);
  const waitingMe = open.filter((m) => m.status === "reported" && m.reported_by !== viewer.id);
  const ordered = [...waitingMe, ...open.filter((m) => !waitingMe.includes(m))];
  return { ordered, done };
}

const oppOf = (m, viewer, people) => people[m.player_a === viewer.id ? m.player_b : m.player_a] ?? { name: "Соперник" };

// Главная карточка лиги: с кем играть прямо сейчас.
function LeagueNow({ t, list, people, viewer, pending, run }) {
  if (!list.length) return null;
  const { ordered, done } = leagueOrder(list, viewer);
  const m = ordered[0];
  if (!m) {
    return (
      <div className="rounded-2xl border border-acid-400/40 bg-dark-800 p-4 text-center">
        <Icon name="check" className="w-7 h-7 mx-auto text-acid-400" />
        <p className="mt-2 font-semibold">Все твои матчи лиги сыграны</p>
        <p className="text-xs text-gray-500 mt-1">
          Побед {done.filter((x) => x.winner_id === viewer.id).length} из {done.length}. Смотри таблицу.
        </p>
      </div>
    );
  }
  const opp = oppOf(m, viewer, people);
  const waiting = m.status === "reported" && m.reported_by !== viewer.id;
  return (
    <div className="rounded-2xl border border-acid-400/60 bg-gradient-to-br from-acid-400/10 to-dark-800 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-acid-400">
          {waiting ? "Ждёт твоего ответа" : "Сейчас"}
          {m.tour ? ` · тур ${m.tour}` : ""}
        </p>
        <p className="text-[11px] text-gray-500">
          сыграно {done.length} из {list.length}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-bold truncate">{opp.name}</p>
          {opp.inGame && <p className="text-xs text-gray-400 truncate">в игре: {opp.inGame}</p>}
        </div>
        {opp.tag && (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(opp.tag)}
            className="shrink-0 text-xs text-gray-400 border border-dark-600 rounded-lg px-2.5 py-1.5 tabular-nums"
          >
            {opp.tag}
          </button>
        )}
      </div>
      <MatchActions t={t} m={m} opp={opp} viewer={viewer} pending={pending} run={run} />
    </div>
  );
}

// Остальные матчи лиги — короткими строками, кнопки по нажатию.
function LeagueRest({ t, list, people, viewer, pending, run }) {
  const [openId, setOpenId] = useState(null);
  const { ordered, done } = leagueOrder(list, viewer);
  const rest = ordered.slice(1);
  const row = (m) => {
    const opp = oppOf(m, viewer, people);
    const isOpen = openId === m.id;
    const result =
      m.status === "done" ? (m.winner_id === viewer.id ? "победа" : "поражение") : m.status === "reported" ? "ждёт ответа" : m.status === "disputed" ? "спор" : null;
    return (
      <div key={m.id} className="rounded-xl border border-dark-600 bg-dark-800">
        <button
          type="button"
          onClick={() => setOpenId(isOpen ? null : m.id)}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left"
        >
          <span className="shrink-0 w-12 text-[11px] text-gray-500">{m.tour ? `Тур ${m.tour}` : ""}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{opp.name}</span>
            {opp.inGame && <span className="block truncate text-[11px] text-gray-500">{opp.inGame}</span>}
          </span>
          {result && (
            <span
              className={`shrink-0 text-[11px] ${
                result === "победа" ? "text-acid-400" : result === "спор" ? "text-amber-400" : "text-gray-500"
              }`}
            >
              {result}
            </span>
          )}
          <Icon
            name="chevronDown"
            className={`w-4 h-4 shrink-0 text-gray-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
        {isOpen && (
          <div className="px-3.5 pb-3 space-y-2">
            {opp.tag && (
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(opp.tag)}
                className="text-[11px] text-gray-400 border border-dark-600 rounded-lg px-2 py-1 tabular-nums"
              >
                Скопировать тег {opp.tag}
              </button>
            )}
            <MatchActions t={t} m={m} opp={opp} viewer={viewer} pending={pending} run={run} compact />
          </div>
        )}
      </div>
    );
  };
  if (!rest.length && !done.length) return null;
  return (
    <div className="space-y-2">
      {rest.length > 0 && (
        <>
          <p className="text-xs text-gray-500 px-1">
            Дальше по турам. Соперник занят? Открой следующий тур, этот доиграешь потом.
          </p>
          {rest.map(row)}
        </>
      )}
      {done.length > 0 && (
        <>
          <p className="text-xs text-gray-500 px-1 pt-2">Сыгранные</p>
          {done.map(row)}
        </>
      )}
    </div>
  );
}

function MyOutcome({ t, me }) {
  if (!me || t.status !== "running") return null;
  if (me.status === "eliminated") {
    return <p className="text-sm text-gray-500 text-center">Для тебя турнир закончен. Следи за сеткой!</p>;
  }
  return null;
}

function MatchRow({ m, people, viewer }) {
  const line = (id) => {
    if (!id) return <span className="text-gray-600">{m.method === "bye" ? "без соперника" : "ждём"}</span>;
    const win = m.winner_id === id;
    const lose = m.winner_id && !win;
    return (
      <span className={`flex items-center gap-1.5 min-w-0 ${win ? "font-bold" : ""} ${lose ? "text-gray-500" : ""}`}>
        <span className="min-w-0">
          <span className="block truncate">{people[id]?.name ?? "Игрок"}</span>
          {people[id]?.inGame && (
            <span className="block truncate text-[11px] font-normal text-gray-500">{people[id].inGame}</span>
          )}
        </span>
        {id === viewer.id && <span className="shrink-0 text-[10px] text-acid-400">ты</span>}
        {win && <Icon name="check" className="w-3.5 h-3.5 shrink-0 text-acid-400" />}
      </span>
    );
  };
  const chip =
    m.method === "bye"
      ? "проходит без игры"
      : m.status === "ready"
        ? `до ${when(m.play_by)}`
        : m.status === "reported"
          ? "ждёт подтверждения"
          : m.status === "disputed"
            ? "спор"
            : m.status === "waiting"
              ? "ждёт игроков"
              : null;
  const mine = m.player_a === viewer.id || m.player_b === viewer.id;
  return (
    <div className={`rounded-xl border bg-dark-800 px-3.5 py-2.5 ${mine ? "border-acid-400/40" : "border-dark-600"}`}>
      <div className="space-y-1 text-sm">
        {line(m.player_a)}
        {line(m.player_b)}
      </div>
      {chip && <p className={`mt-1.5 text-[11px] ${m.status === "disputed" ? "text-amber-400" : "text-gray-500"}`}>{chip}</p>}
    </div>
  );
}

function Bracket({ matches, rounds, people, viewer, bare = false }) {
  const current = Math.min(
    rounds,
    ...matches.filter((m) => ["ready", "reported", "disputed"].includes(m.status)).map((m) => m.round),
    rounds
  );
  const [round, setRound] = useState(current || 1);
  if (!rounds) return null;
  const list = matches.filter((m) => m.round === round);
  return (
    <div className="space-y-2">
      {!bare && <p className="text-sm text-gray-500 px-1">Сетка</p>}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRound(r)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs border ${
              r === round ? "bg-acid-400/15 border-acid-400/40 text-acid-400" : "border-dark-600 text-gray-400"
            }`}
          >
            {roundLabel(r, rounds)}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {list.map((m) => (
          <MatchRow key={m.id} m={m} people={people} viewer={viewer} />
        ))}
      </div>
    </div>
  );
}

// Расписание лиги: все пары по турам. Нужно, чтобы в офисе каждый видел
// не только свой матч, но и кто с кем играет сейчас за соседним столом.
function Schedule({ matches, people, viewer }) {
  const league = matches.filter((m) => m.round === 0 && m.status !== "void");
  if (!league.length) return null;
  const tours = [...new Set(league.map((m) => m.tour ?? 0))].sort((a, b) => a - b);
  const pair = (m) => {
    const mine = m.player_a === viewer.id || m.player_b === viewer.id;
    const done = m.status === "done";
    const chip = done ? null : m.status === "reported" ? "ждёт ответа" : m.status === "disputed" ? "спор" : null;
    return (
      <div
        key={m.id}
        className={`rounded-xl border bg-dark-800 px-3 py-2 ${mine ? "border-acid-400/40" : "border-dark-600"}`}
      >
        <div className="flex items-center gap-2">
          <Who
            p={people[m.player_a]}
            me={m.player_a === viewer.id}
            strong={m.winner_id === m.player_a}
            dim={done && m.winner_id !== m.player_a}
          />
          <span className="shrink-0 text-[11px] text-gray-600">vs</span>
          <Who
            p={people[m.player_b]}
            right
            me={m.player_b === viewer.id}
            strong={m.winner_id === m.player_b}
            dim={done && m.winner_id !== m.player_b}
          />
        </div>
        {chip && <p className="mt-1 text-center text-[10px] text-gray-500">{chip}</p>}
      </div>
    );
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 px-1">
        Пары по турам. Туры показывают порядок, а не время: сыграл свой, сразу иди к сопернику следующего.
      </p>
      {tours.map((tour) => {
        const list = league.filter((m) => (m.tour ?? 0) === tour);
        const played = list.filter((m) => m.status === "done").length;
        return (
          <div key={tour} className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-semibold">{tour ? `Тур ${tour}` : "Матчи лиги"}</p>
              <p className="text-[11px] text-gray-500">
                сыграно {played} из {list.length}
              </p>
            </div>
            {list.map(pair)}
          </div>
        );
      })}
    </div>
  );
}

function Participants({ entries, people, viewer }) {
  if (!entries.length) return <p className="text-sm text-gray-500 text-center">Пока никто не записался. Будь первым!</p>;
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500 px-1">Участники · {entries.length}</p>
      <div className="flex flex-wrap gap-2">
        {entries.map((e) => (
          <span
            key={e.userId}
            className={`rounded-full border px-3 py-1 text-sm ${
              e.userId === viewer.id ? "border-acid-400/40 text-acid-400" : "border-dark-600 text-gray-300"
            }`}
          >
            {people[e.userId]?.name ?? "Игрок"}
            {people[e.userId]?.inGame && (
              <span className="ml-1.5 text-xs text-gray-500">{people[e.userId].inGame}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function Rules({ t }) {
  const league = t.format === "league";
  const size = t.playoff_size ?? 4;
  const wins = t.playoff_wins > 1 ? `до ${t.playoff_wins} побед` : "в один бой";
  const report = (
    <li>
      После боя отметьте итог здесь. «Победа соперника» засчитывается сразу. «Моя победа» ждёт подтверждения соперника{" "}
      {t.confirm_hours} ч, потом засчитывается сама.
    </li>
  );
  return (
    <details className="rounded-2xl border border-dark-600 bg-dark-800 p-4 text-sm text-gray-400">
      <summary className="font-semibold text-gray-200 cursor-pointer">Как проходит турнир</summary>
      <ol className="mt-3 space-y-2 list-decimal pl-5">
        <li>
          <b className="text-gray-200">{MODE_LINE}</b> {MODE_HOW}
        </li>
        <li>Взносы всех участников идут в общий банк{t.bonus_coins > 0 ? `, Pacto добавляет ${formatCoins(t.bonus_coins)}` : ""}.</li>
        {league ? (
          <>
            <li>
              Лига: каждый играет с каждым по одному дружескому бою{t.clan_tag ? ` в клане ${t.clan_tag}` : ""}
              {t.league_ends_at ? `, всё до ${when(t.league_ends_at)}` : ""}.
            </li>
            <li>
              Туры показывают порядок, а не время. Сыграл свой тур, сразу иди к сопернику следующего, остальных ждать не нужно.
            </li>
            {report}
            <li>Места в таблице: больше побед выше. При равенстве меньше поражений, потом кто выиграл личную встречу.</li>
            <li>
              Когда сыграны все матчи лиги, лучшие {size} сразу выходят в плей-офф, матчи {wins}. Первое место
              играет с последним из вышедших. Проиграл, значит выбыл.
            </li>
          </>
        ) : (
          <>
            <li>Когда запись закрывается, сетка собирается случайно. Проиграл матч, значит выбыл.</li>
            <li>
              На матч {t.round_hours} ч, {wins}. Играете дружеский бой{t.clan_tag ? ` в клане ${t.clan_tag}` : ""}: добавьтесь в
              друзья или в один клан.
            </li>
            {report}
          </>
        )}
        <li>Если вы не сошлись в итоге, решает админ.</li>
        <li>
          Победитель финала забирает весь банк. Сверху крутки на колесе фортуны: 5 за первое место, 3 за второе, по 1
          за третье и четвёртое. На рейтинг выручки это не влияет.
        </li>
      </ol>
    </details>
  );
}

export default function TournamentClient({ data, viewer }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(null);
  const { tournament: t, people, entries, matches, rounds, me, myMatch, myLeague = [], stage } = data;
  const leagueOn = t.format === "league" && matches.some((m) => m.round === 0);
  const running = t.status === "running";
  // Свои незаконченные матчи лиги есть — открываем их, иначе сразу таблицу.
  const inLeague = myLeague.length > 0;
  const [tab, setTab] = useState(
    stage === "league" ? (myLeague.some((m) => m.status !== "done") ? "matches" : "table") : rounds > 0 ? "bracket" : "table"
  );

  // Пока турнир идёт, страница сама подтягивает свежие результаты:
  // соперник отметил итог — видно без перезагрузки.
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20000);
    return () => clearInterval(id);
  }, [running, router]);

  const run = (fn) => {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setMsg({ error: res.error });
      router.refresh();
    });
  };

  const table = (bare) => (
    <LeagueTable t={t} entries={entries} matches={matches} people={people} viewer={viewer} bare={bare} />
  );
  const bracket = (bare) =>
    rounds > 0 ? <Bracket matches={matches} rounds={rounds} people={people} viewer={viewer} bare={bare} /> : null;
  const schedule = () => <Schedule matches={matches} people={people} viewer={viewer} />;

  let sections = null;
  if (leagueOn && stage === "league" && running && inLeague) {
    sections = (
      <>
        <LeagueNow t={t} list={myLeague} people={people} viewer={viewer} pending={pending} run={run} />
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { key: "matches", label: "Мои матчи" },
            { key: "tours", label: "Все туры" },
            { key: "table", label: "Таблица" },
          ]}
        />
        {tab === "matches" ? (
          <LeagueRest t={t} list={myLeague} people={people} viewer={viewer} pending={pending} run={run} />
        ) : tab === "tours" ? (
          schedule()
        ) : (
          table(true)
        )}
      </>
    );
  } else if (leagueOn && rounds > 0) {
    sections = (
      <>
        <Tabs
          value={tab === "matches" ? "bracket" : tab}
          onChange={setTab}
          items={[
            { key: "bracket", label: "Плей-офф" },
            { key: "table", label: "Таблица лиги" },
            { key: "tours", label: "Туры лиги" },
          ]}
        />
        {tab === "table" ? table(true) : tab === "tours" ? schedule() : bracket(true)}
      </>
    );
  } else if (leagueOn) {
    sections = (
      <>
        <Tabs
          value={tab === "tours" ? "tours" : "table"}
          onChange={setTab}
          items={[
            { key: "table", label: "Таблица" },
            { key: "tours", label: "Все туры" },
          ]}
        />
        {tab === "tours" ? schedule() : table(true)}
      </>
    );
  } else if (rounds > 0) {
    sections = bracket(false);
  } else {
    sections = <Participants entries={entries} people={people} viewer={viewer} />;
  }

  return (
    <div className="space-y-4">
      {running ? (
        <HeroCompact t={t} players={entries.length} stage={stage} />
      ) : (
        <Hero t={t} players={entries.length} winnerName={t.winner_id ? people[t.winner_id]?.name : null} stage={stage} />
      )}
      {msg?.error && <p className="text-sm text-red-400 text-center">{msg.error}</p>}
      {!me && !viewer.isGuest && <HowToJoin t={t} />}
      <JoinBlock t={t} me={me} viewer={viewer} pending={pending} run={run} />
      <MyNickCard t={t} me={me} viewer={viewer} pending={pending} run={run} />
      {me && !["finished", "cancelled"].includes(t.status) && <ModeNote />}
      <MyMatch t={t} m={myMatch} people={people} viewer={viewer} rounds={rounds} pending={pending} run={run} />
      <MyOutcome t={t} me={me} />
      {t.status === "cancelled" && (
        <p className="text-sm text-gray-500 text-center">Турнир отменён, взносы вернули на баланс.</p>
      )}
      {sections}
      {t.description && <p className="text-sm text-gray-400 whitespace-pre-line">{t.description}</p>}
      <Rules t={t} />
    </div>
  );
}
