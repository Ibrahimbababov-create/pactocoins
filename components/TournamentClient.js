"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { formatCoins } from "@/lib/plural";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import { roundLabel, leagueStandings } from "@/lib/tournamentRounds";
import {
  joinTournament,
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
        <span className="text-xs text-gray-500">Clash Royale</span>
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
    "Впиши тег ниже и нажми «Участвовать». Когда запись закроется, бот пришлёт соперников.",
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
        disabled={pending || short || !tag.trim()}
        onClick={() =>
          window.confirm(
            t.entry_fee > 0
              ? `Записаться в турнир? ${formatCoins(t.entry_fee)} уйдут в общий банк. До старта можно выйти и вернуть взнос.`
              : "Записаться в турнир?"
          ) && run(() => joinTournament(t.id, tag))
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

function MatchActions({ t, m, opp, viewer, pending, run, compact = false }) {
  const bigBtn = compact ? "rounded-lg py-2 text-xs" : "rounded-xl py-2.5 text-sm";
  if (m.status === "ready") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            window.confirm(`Победа твоя? ${opp.name} получит запрос на подтверждение.`) &&
            run(() => reportMatch(m.id, "won"))
          }
          className={`bg-acid-400 text-black font-bold disabled:opacity-50 ${bigBtn}`}
        >
          Моя победа
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            window.confirm(`Победа за ${opp.name}? Это сразу засчитается.`) && run(() => reportMatch(m.id, "lost"))
          }
          className={`border border-dark-600 text-gray-300 disabled:opacity-50 ${bigBtn}`}
        >
          Победа соперника
        </button>
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
        <p className="text-xs text-gray-300">{opp.name} сообщает о своей победе. Так и было?</p>
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
            {t.playoff_wins > 1 ? `Играйте до ${t.playoff_wins} побед. ` : ""}
            Сыграйте дружеский бой до <b className="text-gray-200">{when(m.play_by)}</b>
            {t.clan_tag ? ` в клане ${t.clan_tag}` : ""}. Потом отметь итог.
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

function LeagueTable({ t, entries, matches, people, viewer, collapsed }) {
  const table = leagueStandings(
    entries.map((e) => e.userId),
    matches
  );
  const cut = t.playoff_size ?? 4;
  const played = matches.filter((m) => m.round === 0 && m.status === "done").length;
  const total = matches.filter((m) => m.round === 0 && m.status !== "void").length;
  const body = (
    <div className="rounded-2xl border border-dark-600 bg-dark-800 overflow-hidden">
      <div className="grid grid-cols-[28px_1fr_36px_36px] gap-2 px-4 py-2 text-[11px] text-gray-500 border-b border-dark-700">
        <span>#</span>
        <span>Игрок</span>
        <span className="text-right">Поб.</span>
        <span className="text-right">Пор.</span>
      </div>
      {table.map((r) => (
        <div
          key={r.userId}
          className={`grid grid-cols-[28px_1fr_36px_36px] gap-2 px-4 py-2 text-sm ${
            r.place === cut ? "border-b border-dashed border-acid-400/40" : ""
          } ${r.userId === viewer.id ? "text-acid-400" : ""}`}
        >
          <span className="tabular-nums text-gray-500">{r.place}</span>
          <span className="truncate">{people[r.userId]?.name ?? "Игрок"}</span>
          <span className="text-right tabular-nums">{r.wins}</span>
          <span className="text-right tabular-nums text-gray-500">{r.losses}</span>
        </div>
      ))}
      <p className="px-4 py-2 text-[11px] text-gray-500 border-t border-dark-700">
        Выше черты — в плей-офф. Сыграно матчей: {played} из {total}.
      </p>
    </div>
  );
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

function MyLeague({ t, list, people, viewer, pending, run }) {
  if (!list.length) return null;
  const left = list.filter((m) => m.status !== "done").length;
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500 px-1">
        Твои матчи в лиге · осталось {left} из {list.length}
      </p>
      {t.clan_tag && <p className="text-xs text-gray-500 px-1">Играйте дружеский бой в клане {t.clan_tag}.</p>}
      {list
        .slice()
        .sort((a, b) => (a.status === "done") - (b.status === "done"))
        .map((m) => {
          const oppId = m.player_a === viewer.id ? m.player_b : m.player_a;
          const opp = people[oppId] ?? { name: "Соперник" };
          return (
            <div
              key={m.id}
              className={`rounded-xl border bg-dark-800 p-3 space-y-2 ${
                m.status === "done" ? "border-dark-700 opacity-70" : "border-dark-600"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold truncate">{opp.name}</span>
                {opp.tag && (
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(opp.tag)}
                    className="shrink-0 text-[11px] text-gray-500 tabular-nums"
                  >
                    {opp.tag}
                  </button>
                )}
              </div>
              <MatchActions t={t} m={m} opp={opp} viewer={viewer} pending={pending} run={run} compact />
            </div>
          );
        })}
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
        <span className="truncate">{people[id]?.name ?? "Игрок"}</span>
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

function Bracket({ matches, rounds, people, viewer }) {
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
      <p className="text-sm text-gray-500 px-1">Сетка</p>
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
          </span>
        ))}
      </div>
    </div>
  );
}

function Rules({ t }) {
  return (
    <details className="rounded-2xl border border-dark-600 bg-dark-800 p-4 text-sm text-gray-400">
      <summary className="font-semibold text-gray-200 cursor-pointer">Как проходит турнир</summary>
      <ol className="mt-3 space-y-2 list-decimal pl-5">
        <li>Взносы всех участников идут в общий банк{t.bonus_coins > 0 ? `, Pacto добавляет ${formatCoins(t.bonus_coins)}` : ""}.</li>
        <li>Когда запись закрывается, сетка собирается случайно. Проиграл матч, значит выбыл.</li>
        <li>
          На матч {t.round_hours} ч. Играете дружеский бой{t.clan_tag ? ` в клане ${t.clan_tag}` : ""}: добавьтесь в друзья
          или в один клан.
        </li>
        <li>
          После боя отметьте итог здесь или в боте. «Победа соперника» засчитывается сразу. «Моя победа» ждёт подтверждения
          соперника {t.confirm_hours} ч, потом засчитывается сама.
        </li>
        <li>Если вы не сошлись в итоге, решает админ.</li>
        <li>Победитель финала забирает весь банк. На рейтинг выручки это не влияет.</li>
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

  const run = (fn) => {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setMsg({ error: res.error });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <Hero t={t} players={entries.length} winnerName={t.winner_id ? people[t.winner_id]?.name : null} stage={stage} />
      {msg?.error && <p className="text-sm text-red-400 text-center">{msg.error}</p>}
      {!me && !viewer.isGuest && <HowToJoin t={t} />}
      <JoinBlock t={t} me={me} viewer={viewer} pending={pending} run={run} />
      <MyMatch t={t} m={myMatch} people={people} viewer={viewer} rounds={rounds} pending={pending} run={run} />
      <MyOutcome t={t} me={me} />
      {t.status === "cancelled" && (
        <p className="text-sm text-gray-500 text-center">Турнир отменён, взносы вернули на баланс.</p>
      )}
      {leagueOn && stage === "league" && t.status === "running" && (
        <MyLeague t={t} list={myLeague} people={people} viewer={viewer} pending={pending} run={run} />
      )}
      {rounds > 0 && <Bracket matches={matches} rounds={rounds} people={people} viewer={viewer} />}
      {leagueOn && (
        <LeagueTable
          t={t}
          entries={entries}
          matches={matches}
          people={people}
          viewer={viewer}
          collapsed={stage === "playoff"}
        />
      )}
      {!leagueOn && rounds === 0 && <Participants entries={entries} people={people} viewer={viewer} />}
      {t.description && <p className="text-sm text-gray-400 whitespace-pre-line">{t.description}</p>}
      <Rules t={t} />
    </div>
  );
}
