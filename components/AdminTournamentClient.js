"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { formatCoins, plural } from "@/lib/plural";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import { roundLabel, leagueStandings, winsNeeded, battlesPlayed, battleSeq } from "@/lib/tournamentRounds";
import AdminTournamentForm from "@/components/AdminTournamentForm";
import {
  openRegistration,
  startTournamentAction,
  startPlayoffAction,
  sendLeagueTable,
  cancelTournament,
  setTournamentHidden,
  messageTournamentPlayers,
  removeEntry,
  decideMatch,
  setSeriesScore,
  replayMatch,
  extendMatch,
} from "@/app/admin/tournamentActions";

const when = (v) => formatDateTimeAlmaty(v).replace(/\.\d{4},/, ",");
const STATUS = {
  draft: "Черновик",
  registration: "Идёт запись",
  seeding: "Собираем сетку",
  running: "Идёт",
  finished: "Завершён",
  cancelled: "Отменён",
};
const MATCH = {
  waiting: "ждёт игроков",
  ready: "играют",
  reported: "ждёт подтверждения",
  disputed: "спор",
  done: "сыгран",
  void: "отменён",
};
const METHOD = {
  bye: "без игры",
  loser_report: "проигравший подтвердил",
  confirmed: "соперник подтвердил",
  auto_confirm: "засчитано по сроку",
  admin: "решение админа",
  walkover: "техническая победа",
  api: "по данным игры",
};

const btn = "rounded-lg border border-dark-600 px-2.5 py-1.5 text-xs text-gray-300 disabled:opacity-50";

// Время «18:00» из даты, по Алматы.
const hhmm = (v) => formatDateTimeAlmaty(v).match(/\d{1,2}:\d{2}/)?.[0] ?? "";

// Черновик напоминания перед стартом. Лигу обычно запускаем через полчаса
// после конца записи, выйти с возвратом взноса можно, пока идёт запись.
function reminderDraft(t, count) {
  if (t.status !== "registration" || !t.registration_ends_at) return "";
  const ends = new Date(t.registration_ends_at);
  const fee = t.entry_fee > 0 ? `, взнос ${formatCoins(t.entry_fee)} вернётся на баланс` : "";
  return (
    `Напоминаю: сегодня в ${hhmm(new Date(ends.getTime() + 30 * 60000))} рубимся в Clash Royale 🏆\n` +
    `Нас ${count} ${plural(count, "человек", "человека", "человек")}, будет жарко.\n\n` +
    `Если вечером не получается, ничего страшного. Выйди из турнира до ${hhmm(ends)}: ` +
    `кнопка «Открыть турнир», потом «Выйти»${fee}.`
  );
}

// Написать всем участникам в личку от бота, с кнопкой «Открыть турнир».
function PlayersMessage({ t, count }) {
  const [text, setText] = useState(() => reminderDraft(t, count));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(null);

  function send() {
    if (!window.confirm(`Отправить это сообщение ${count} ${plural(count, "участнику", "участникам", "участникам")} в личку?`)) return;
    setMsg(null);
    start(async () => {
      const res = await messageTournamentPlayers(t.id, text);
      setMsg(res?.error ? { error: res.error } : { ok: `Отправлено ${res.sent} из ${res.total}` });
    });
  }

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3">
      <p className="font-semibold">Написать участникам</p>
      <p className="text-xs text-gray-500">Бот пришлёт это каждому участнику в личку, с кнопкой «Открыть турнир».</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={1500}
        placeholder="Текст сообщения"
        className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={send}
          className="bg-acid-400 text-black font-bold rounded-lg px-3 py-2 text-sm disabled:opacity-50"
        >
          {pending ? "Отправляем…" : `Отправить ${count} ${plural(count, "участнику", "участникам", "участникам")}`}
        </button>
        {msg?.error && <span className="text-xs text-red-400">{msg.error}</span>}
        {msg?.ok && <span className="text-xs text-acid-400">{msg.ok}</span>}
      </div>
    </div>
  );
}

// Матчи лиги для админа: выбрал тур, видишь пары этого тура и ставишь
// итог кнопкой с именем. Нужно, когда игрок не может нажать сам: не зашёл
// в приложение, ушёл домой, играл за другого.
function LeagueAdmin({ matches, people, pending, run }) {
  const league = matches.filter((m) => m.round === 0 && m.status !== "void");
  const tours = [...new Set(league.map((m) => m.tour ?? 0))].sort((a, b) => a - b);
  const firstOpen = tours.find((x) => league.some((m) => (m.tour ?? 0) === x && m.status !== "done"));
  const [tour, setTour] = useState(firstOpen ?? tours[0] ?? 0);
  if (!league.length) return null;

  const name = (id) => people[id]?.name ?? "—";
  const list = league.filter((m) => (m.tour ?? 0) === tour).sort((a, b) => a.slot - b.slot);
  // После старта плей-офф итоги лиги уже не меняются: по ним собрана сетка.
  const canReplay = !matches.some((m) => m.round > 0);
  const waiting = league.filter((m) => m.status === "reported");

  const row = (m) => {
    const claimed = m.status === "reported" ? m.reported_winner : null;
    const other = claimed ? (claimed === m.player_a ? m.player_b : m.player_a) : null;
    return (
      <div key={m.id} className="rounded-xl border border-dark-600 bg-dark-800 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 text-sm">
            <b className={m.winner_id === m.player_a ? "text-acid-400" : ""}>{name(m.player_a)}</b>
            <span className="text-gray-500"> против </span>
            <b className={m.winner_id === m.player_b ? "text-acid-400" : ""}>{name(m.player_b)}</b>
          </p>
          <span className="shrink-0 text-[11px] text-gray-500">
            {m.tour ? `тур ${m.tour}` : ""}
          </span>
        </div>
        {m.status === "done" ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-400">Победа: {name(m.winner_id)}</p>
            {canReplay && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  window.confirm(
                    `Сбросить итог матча ${name(m.player_a)} против ${name(m.player_b)}? Победа уйдёт из таблицы, бот напишет обоим сыграть заново.`
                  ) && run(() => replayMatch(m.id))
                }
                className="shrink-0 text-xs text-gray-500 underline disabled:opacity-50"
              >
                переиграть
              </button>
            )}
          </div>
        ) : (
          <>
            {claimed && (
              <p className="text-xs text-amber-400">{name(claimed)} говорит, что выиграл. Соперник пока не ответил.</p>
            )}
            {m.status === "disputed" && <p className="text-xs text-amber-400">Спор: решай сам.</p>}
            <div className="grid grid-cols-2 gap-2">
              {claimed ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      window.confirm(`Записать победу: ${name(claimed)}?`) && run(() => decideMatch(m.id, claimed))
                    }
                    className="bg-acid-400 text-black font-bold rounded-lg py-2 text-xs disabled:opacity-50"
                  >
                    Победа: {name(claimed)}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      window.confirm(`Записать победу: ${name(other)}?`) && run(() => decideMatch(m.id, other))
                    }
                    className="border border-dark-600 text-gray-300 rounded-lg py-2 text-xs disabled:opacity-50"
                  >
                    Победа: {name(other)}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      window.confirm(`Записать победу: ${name(m.player_a)}?`) &&
                      run(() => decideMatch(m.id, m.player_a))
                    }
                    className="border border-dark-600 text-gray-300 rounded-lg py-2 text-xs disabled:opacity-50"
                  >
                    Победа: {name(m.player_a)}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      window.confirm(`Записать победу: ${name(m.player_b)}?`) &&
                      run(() => decideMatch(m.id, m.player_b))
                    }
                    className="border border-dark-600 text-gray-300 rounded-lg py-2 text-xs disabled:opacity-50"
                  >
                    Победа: {name(m.player_b)}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {waiting.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-amber-400 px-1">Ждут подтверждения · {waiting.length}</p>
          {waiting.map(row)}
        </div>
      )}
      <div className="space-y-2">
        <p className="text-sm text-gray-500 px-1">Матчи лиги: нажми тур, потом победителя</p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {tours.map((x) => {
            const left = league.filter((m) => (m.tour ?? 0) === x && m.status !== "done").length;
            return (
              <button
                key={x}
                type="button"
                onClick={() => setTour(x)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs border ${
                  x === tour ? "bg-acid-400/15 border-acid-400/40 text-acid-400" : "border-dark-600 text-gray-400"
                }`}
              >
                Тур {x}
                {left > 0 ? ` · ${left}` : " ✓"}
              </button>
            );
          })}
        </div>
        {list.map(row)}
      </div>
    </div>
  );
}

// Как засчитан бой серии, коротко: для журнала боёв. Фразы без глаголов
// прошедшего времени, чтобы не гадать с родом.
const BATTLE_HOW = {
  loser_report: (loser) => `${loser}: «победа соперника»`,
  confirmed: (_, by) => `${by}: «подтверждаю»`,
  auto_confirm: () => "засчитано по сроку",
  admin: (_, by) => `решение админа, ${by}`,
  walkover: (_, by) => `техническая победа, ${by}`,
};

// Журнал серии: «Бой 1: Наиль, Абдрахим подтвердил». Поправки админа тоже тут.
function BattleLog({ m, name }) {
  const list = Array.isArray(m.battles) ? m.battles : [];
  if (!list.length) return null;
  const other = (id) => (id === m.player_a ? m.player_b : m.player_a);
  return (
    <ol className="space-y-0.5 text-[11px] text-gray-500">
      {list.map((b, i) =>
        b.fix ? (
          <li key={i}>
            {when(b.at)}: счёт поправлен на {b.a} : {b.b}, {name(b.by)}
          </li>
        ) : (
          <li key={i}>
            Бой {b.n}: <b className="text-gray-300">{name(b.winner)}</b>
            {BATTLE_HOW[b.method] ? `, ${BATTLE_HOW[b.method](name(other(b.winner)), name(b.by))}` : ""}
          </li>
        )
      )}
    </ol>
  );
}

// Правка счёта серии: игрок ошибся кнопкой, бой засчитали не тому,
// соперник не пришёл. Если у кого-то нужные победы, серия закрывается.
function ScoreEditor({ m, need, name, pending, run, onClose }) {
  const [a, setA] = useState(m.wins_a ?? 0);
  const [b, setB] = useState(m.wins_b ?? 0);
  const bad = a === need && b === need;
  const ends = !bad && (a === need || b === need);
  const step = (v, set) => (
    <span className="flex items-center gap-1.5">
      <button type="button" onClick={() => set(Math.max(0, v - 1))} className={`${btn} w-8`} aria-label="Меньше">
        −
      </button>
      <span className="w-6 text-center font-display font-bold text-lg tabular-nums">{v}</span>
      <button type="button" onClick={() => set(Math.min(need, v + 1))} className={`${btn} w-8`} aria-label="Больше">
        +
      </button>
    </span>
  );
  return (
    <div className="rounded-lg border border-dark-600 bg-dark-900/60 p-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs text-gray-400">{name(m.player_a)}</p>
          {step(a, setA)}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs text-gray-400">{name(m.player_b)}</p>
          {step(b, setB)}
        </div>
      </div>
      <p className={`text-[11px] ${bad ? "text-red-400" : ends ? "text-amber-400" : "text-gray-500"}`}>
        {bad
          ? `${need} побед может быть только у одного`
          : ends
            ? `Серия закончится: проходит ${name(a === need ? m.player_a : m.player_b)}`
            : `До ${need} побед. Текущая заявка на бой сбросится, следующий бой играют заново.`}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || bad || (a === (m.wins_a ?? 0) && b === (m.wins_b ?? 0))}
          onClick={() =>
            window.confirm(
              ends
                ? `Поставить ${a} : ${b} и закрыть серию в пользу ${name(a === need ? m.player_a : m.player_b)}?`
                : `Поставить счёт ${a} : ${b}?`
            ) && run(() => setSeriesScore(m.id, a, b, battleSeq(m)), onClose)
          }
          className="bg-acid-400 text-black font-bold rounded-lg px-3 py-2 text-xs disabled:opacity-50"
        >
          Сохранить счёт
        </button>
        <button type="button" onClick={onClose} className={btn}>
          Отмена
        </button>
      </div>
    </div>
  );
}

function MatchAdmin({ t, m, people, rounds, pending, run, now }) {
  const [editing, setEditing] = useState(false);
  const name = (id) => people[id]?.name ?? "—";
  const overdue = m.status === "ready" && m.play_by && new Date(m.play_by).getTime() < now;
  const open = ["ready", "reported", "disputed"].includes(m.status);
  const need = winsNeeded(t, m);
  const series = need > 1;
  const n = battlesPlayed(m) + 1;
  const seen = battleSeq(m);
  // Старые матчи (до счёта боёв) закрыты со счётом 0 : 0, его не показываем.
  const showScore = series && m.player_a && m.player_b && m.method !== "bye" && (open || battlesPlayed(m) > 0);
  const battle = series ? `Бой ${n}: ` : "";
  const hasLog = series && Array.isArray(m.battles) && m.battles.length > 0;
  const ask = (id) => (series ? `Бой ${n}: победа ${name(id)}?` : `Победа: ${name(id)}?`);
  return (
    <div
      className={`rounded-xl border bg-dark-800 p-3 space-y-2 ${
        m.status === "disputed" || overdue ? "border-amber-400/50" : "border-dark-600"
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          {roundLabel(m.round, rounds)}
          {m.tour ? ` · тур ${m.tour}` : ""}
          {series ? ` · до ${need} побед` : ""}
        </span>
        <span className={m.status === "disputed" || overdue ? "text-amber-400" : ""}>
          {overdue ? "просрочен" : MATCH[m.status]}
          {m.method ? ` · ${METHOD[m.method]}` : ""}
        </span>
      </div>
      {showScore ? (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
          <b className={`truncate ${m.winner_id && m.winner_id === m.player_a ? "text-acid-400" : ""}`}>{name(m.player_a)}</b>
          <span className="font-display font-bold text-xl tabular-nums">
            {m.wins_a ?? 0}
            <span className="mx-1 text-gray-600">:</span>
            {m.wins_b ?? 0}
          </span>
          <b className={`truncate text-right ${m.winner_id && m.winner_id === m.player_b ? "text-acid-400" : ""}`}>
            {name(m.player_b)}
          </b>
        </div>
      ) : (
        <p className="text-sm">
          <b className={m.winner_id && m.winner_id === m.player_a ? "text-acid-400" : ""}>{name(m.player_a)}</b>
          <span className="text-gray-500"> против </span>
          <b className={m.winner_id && m.winner_id === m.player_b ? "text-acid-400" : ""}>{name(m.player_b)}</b>
        </p>
      )}
      {m.status === "ready" && m.play_by && (
        <p className="text-xs text-gray-500">
          {series ? `Идёт бой ${n}, серию доиграть до ${when(m.play_by)}` : `Сыграть до ${when(m.play_by)}`}
        </p>
      )}
      {m.status === "done" && m.method !== "bye" && (
        <p className="text-xs text-gray-400">
          {when(m.decided_at)}: победа {name(m.winner_id)}
          {showScore ? `, серия ${Math.max(m.wins_a ?? 0, m.wins_b ?? 0)} : ${Math.min(m.wins_a ?? 0, m.wins_b ?? 0)}` : ""}.{" "}
          {/* в серии как засчитан каждый бой, видно в журнале ниже */}
          {!hasLog && m.method === "loser_report" &&
            `${name(m.winner_id === m.player_a ? m.player_b : m.player_a)}: «победа соперника».`}
          {!hasLog && m.method === "confirmed" && `${name(m.reported_winner)}: «моя победа», ${name(m.decided_by)}: «подтверждаю».`}
          {!hasLog && m.method === "auto_confirm" && `${name(m.reported_winner)}: «моя победа», соперник не ответил, засчитано по сроку.`}
          {!hasLog && (m.method === "admin" || m.method === "walkover") && `Решил админ ${name(m.decided_by)}.`}
        </p>
      )}
      {m.status === "reported" && (
        <p className="text-xs text-gray-400">
          {battle}
          {name(m.reported_winner)}: «моя победа». Засчитаем сами {when(m.confirm_by)}
        </p>
      )}
      {m.status === "disputed" && (
        <p className="text-xs text-amber-400">
          Спор{series ? ` по бою ${n}` : ""}. {name(m.reported_winner)}: «моя победа». {name(m.disputed_by)}: «это не так»
          {m.dispute_note ? `, «${m.dispute_note}»` : ""}
        </p>
      )}
      {hasLog && <BattleLog m={m} name={name} />}
      {open && m.player_a && m.player_b && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() =>
              window.confirm(ask(m.player_a)) && run(() => decideMatch(m.id, m.player_a, false, seen))
            }
          >
            {series ? `Бой ${n}: ${name(m.player_a)}` : `Победа: ${name(m.player_a)}`}
          </button>
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() =>
              window.confirm(ask(m.player_b)) && run(() => decideMatch(m.id, m.player_b, false, seen))
            }
          >
            {series ? `Бой ${n}: ${name(m.player_b)}` : `Победа: ${name(m.player_b)}`}
          </button>
          <button type="button" disabled={pending} className={btn} onClick={() => run(() => replayMatch(m.id))}>
            {series ? "Переиграть бой" : "Переиграть"}
          </button>
          {m.status === "ready" && (
            <button type="button" disabled={pending} className={btn} onClick={() => run(() => extendMatch(m.id, 12))}>
              +12 ч
            </button>
          )}
          {series && !editing && (
            <button type="button" disabled={pending} className={btn} onClick={() => setEditing(true)}>
              Поправить счёт
            </button>
          )}
        </div>
      )}
      {open && series && editing && (
        <ScoreEditor m={m} need={need} name={name} pending={pending} run={run} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

export default function AdminTournamentClient({ data, now }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(null);
  const { tournament: t, people, entries, matches, rounds } = data;

  const run = (fn, onDone) => {
    setMsg(null);
    start(async () => {
      const res = await fn();
      setMsg(res?.error ? { error: res.error } : { ok: "Готово" });
      if (!res?.error) onDone?.();
      router.refresh();
    });
  };

  const isLeague = t.format === "league";
  const leagueStage = isLeague && t.status === "running" && !matches.some((m) => m.round > 0);
  const table = isLeague ? leagueStandings(entries.map((e) => e.userId), matches) : [];
  const leftLeague = matches.filter((m) => m.round === 0 && ["ready", "reported", "disputed"].includes(m.status)).length;
  const needs = matches.filter(
    (m) =>
      m.round > 0 &&
      (m.status === "disputed" || (m.status === "ready" && m.play_by && new Date(m.play_by).getTime() < now))
  );
  // Несыгранные сверху: по ним и нужны кнопки. Матчи лиги (round 0) тоже
  // здесь: если человек не смог зайти в приложение, итог ставит админ.
  const openFirst = (m) => (["ready", "reported", "disputed"].includes(m.status) ? 0 : 1);
  const rest = matches
    .filter((m) => m.round > 0 && m.method !== "bye" && !needs.includes(m))
    .sort(
      (a, b) =>
        openFirst(a) - openFirst(b) || b.round - a.round || (a.tour ?? 0) - (b.tour ?? 0) || a.slot - b.slot
    );

  return (
    <div className="space-y-4">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">
            {STATUS[t.status]}
            {t.is_test ? " · тестовый" : ""}
          </p>
          <p className="text-sm text-acid-400 tabular-nums">Банк {formatCoins(t.pot)}</p>
        </div>
        <p className="text-xs text-gray-500">
          Взнос {formatCoins(t.entry_fee)} · Pacto +{Number(t.bonus_coins || 0).toLocaleString("ru-RU")} · игроков {entries.length}
          {t.max_players ? `/${t.max_players}` : ""}
          {t.registration_ends_at ? ` · запись до ${when(t.registration_ends_at)}` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {t.status === "draft" && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                window.confirm(
                  t.is_test ? "Открыть запись? Турнир тестовый, в группу ничего не уйдёт." : "Открыть запись? Бот напишет в общую группу."
                ) && run(() => openRegistration(t.id))
              }
              className="bg-acid-400 text-black font-bold rounded-lg px-3 py-2 text-sm disabled:opacity-50"
            >
              Открыть запись
            </button>
          )}
          {t.status === "draft" && !t.is_test && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                window.confirm("Открыть запись без сообщения бота? Анонс в группу выложишь сам.") &&
                run(() => openRegistration(t.id, { silent: true }))
              }
              className="border border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-300 disabled:opacity-50"
            >
              Открыть без поста в группу
            </button>
          )}
          {t.status === "registration" && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                window.confirm(
                  isLeague
                    ? `Закрыть запись и начать лигу из ${entries.length} игроков? Бот пришлёт каждому список соперников.`
                    : `Закрыть запись и собрать сетку из ${entries.length} игроков? Бот напишет каждому его соперника.`
                ) && run(() => startTournamentAction(t.id))
              }
              className="bg-acid-400 text-black font-bold rounded-lg px-3 py-2 text-sm disabled:opacity-50"
            >
              {isLeague ? "Запустить лигу" : "Запустить сетку"}
            </button>
          )}
          {isLeague && t.status === "running" && matches.some((m) => m.round === 0) && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                window.confirm("Отправить текущую таблицу лиги в общую группу?") && run(() => sendLeagueTable(t.id))
              }
              className="border border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-300 disabled:opacity-50"
            >
              Таблицу в группу
            </button>
          )}
          {leagueStage && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                window.confirm(
                  (leftLeague ? `В лиге не сыграно матчей: ${leftLeague}, они не засчитаются. ` : "") +
                    `Запустить плей-офф для лучших ${Math.min(t.playoff_size ?? 4, entries.length)}?`
                ) && run(() => startPlayoffAction(t.id))
              }
              className="bg-acid-400 text-black font-bold rounded-lg px-3 py-2 text-sm disabled:opacity-50"
            >
              Запустить плей-офф
            </button>
          )}
          {["draft", "registration", "seeding", "running"].includes(t.status) && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                window.confirm("Отменить турнир? Всем вернём взносы, сетка остановится.") && run(() => cancelTournament(t.id))
              }
              className="border border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-300 disabled:opacity-50"
            >
              Отменить с возвратом
            </button>
          )}
          {["finished", "cancelled", "draft"].includes(t.status) && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setTournamentHidden(t.id, !t.hidden_at))}
              className="border border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-300 disabled:opacity-50"
            >
              {t.hidden_at ? "Вернуть в игры" : "Скрыть из игр"}
            </button>
          )}
        </div>
        {t.hidden_at && (
          <p className="text-xs text-gray-500">Скрыт: в «Играх» и на главной его не видно, страница открывается только по ссылке.</p>
        )}
        <p className="text-[11px] text-gray-500">
          Создан {when(t.created_at)}
          {t.started_at ? ` · старт ${when(t.started_at)}` : ""}
          {t.finished_at ? ` · завершён ${when(t.finished_at)}` : ""}
          {t.cancelled_at ? ` · отменён ${when(t.cancelled_at)}` : ""}
        </p>
        {msg?.error && <p className="text-xs text-red-400">{msg.error}</p>}
        {msg?.ok && <p className="text-xs text-acid-400">{msg.ok}</p>}
      </div>

      {["registration", "running"].includes(t.status) && entries.length > 0 && (
        <PlayersMessage t={t} count={entries.length} />
      )}

      {t.status === "finished" && t.winner_id && (
        <div className="flex items-center gap-3 rounded-2xl border border-acid-400/40 bg-dark-800 p-4">
          <Icon name="trophy" className="w-8 h-8 shrink-0 text-acid-400" />
          <div className="min-w-0">
            <p className="font-semibold">Победитель: {people[t.winner_id]?.name ?? "—"}</p>
            <p className="text-xs text-gray-400">
              {t.pot_coins > 0
                ? `Банк ${formatCoins(t.pot_coins)} выплачен${t.paid_out_at ? ` ${when(t.paid_out_at)}` : ""}`
                : "Банка не было: турнир без взноса"}
              {t.bonus_coins > 0 ? `, из них ${formatCoins(t.bonus_coins)} добавил Pacto` : ""}
            </p>
          </div>
        </div>
      )}

      {isLeague && t.status === "running" && (
        <LeagueAdmin matches={matches} people={people} pending={pending} run={run} />
      )}

      {leagueStage && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 px-1">
            Таблица лиги · осталось матчей {leftLeague}
          </p>
          <div className="divide-y divide-dark-700 rounded-2xl border border-dark-600 bg-dark-800">
            {table.map((r) => (
              <div
                key={r.userId}
                className={`flex items-center justify-between gap-2 px-4 py-2 text-sm ${
                  r.place <= (t.playoff_size ?? 4) ? "" : "text-gray-500"
                }`}
              >
                <span className="truncate">
                  {r.place}. {people[r.userId]?.name ?? "—"}
                </span>
                <span className="shrink-0 tabular-nums">
                  {r.wins} : {r.losses}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {needs.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-amber-400 px-1">Нужно решение · {needs.length}</p>
          {needs.map((m) => (
            <MatchAdmin key={m.id} t={t} m={m} people={people} rounds={rounds} pending={pending} run={run} now={now} />
          ))}
        </div>
      )}

      {["draft", "registration"].includes(t.status) && <AdminTournamentForm tournament={t} />}

      <div className="space-y-2">
        <p className="text-sm text-gray-500 px-1">Участники · {entries.length}</p>
        {entries.length === 0 && <p className="text-sm text-gray-500 px-1">Пока никого.</p>}
        <div className="divide-y divide-dark-700 rounded-2xl border border-dark-600 bg-dark-800">
          {entries.map((e) => (
            <div key={e.userId} className="flex items-center justify-between gap-2 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm truncate">
                  {people[e.userId]?.name ?? "—"}
                  {people[e.userId]?.inGame && (
                    <span className="ml-1.5 text-xs text-gray-500">{people[e.userId].inGame}</span>
                  )}
                </p>
                <p className="text-[11px] text-gray-500 tabular-nums">
                  {people[e.userId]?.tag ?? "без тега"}
                  {people[e.userId] && !people[e.userId].inGame ? " · без ника" : ""}
                  {e.status !== "active" ? ` · ${e.status === "winner" ? "победитель" : "выбыл"}` : ""}
                </p>
                <p className="text-[11px] text-gray-600">
                  {e.paid > 0 ? `взнос ${formatCoins(e.paid)} · ` : ""}записался {when(e.joinedAt)}
                </p>
              </div>
              {["draft", "registration"].includes(t.status) && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    window.confirm(`Убрать ${people[e.userId]?.name ?? "участника"} и вернуть взнос?`) &&
                    run(() => removeEntry(t.id, e.userId))
                  }
                  className="shrink-0 text-xs text-gray-400 underline disabled:opacity-50"
                >
                  Убрать
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {rest.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 px-1">Матчи</p>
          {rest.map((m) => (
            <MatchAdmin key={m.id} t={t} m={m} people={people} rounds={rounds} pending={pending} run={run} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}
