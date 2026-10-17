"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCoins } from "@/lib/plural";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import { roundLabel } from "@/lib/tournamentRounds";
import AdminTournamentForm from "@/components/AdminTournamentForm";
import {
  openRegistration,
  startTournamentAction,
  cancelTournament,
  removeEntry,
  decideMatch,
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

function MatchAdmin({ m, people, rounds, pending, run, now }) {
  const name = (id) => people[id]?.name ?? "—";
  const overdue = m.status === "ready" && m.play_by && new Date(m.play_by).getTime() < now;
  const open = ["ready", "reported", "disputed"].includes(m.status);
  return (
    <div
      className={`rounded-xl border bg-dark-800 p-3 space-y-2 ${
        m.status === "disputed" || overdue ? "border-amber-400/50" : "border-dark-600"
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span>{roundLabel(m.round, rounds)}</span>
        <span className={m.status === "disputed" || overdue ? "text-amber-400" : ""}>
          {overdue ? "просрочен" : MATCH[m.status]}
          {m.method ? ` · ${METHOD[m.method]}` : ""}
        </span>
      </div>
      <p className="text-sm">
        <b className={m.winner_id && m.winner_id === m.player_a ? "text-acid-400" : ""}>{name(m.player_a)}</b>
        <span className="text-gray-500"> против </span>
        <b className={m.winner_id && m.winner_id === m.player_b ? "text-acid-400" : ""}>{name(m.player_b)}</b>
      </p>
      {m.status === "ready" && m.play_by && <p className="text-xs text-gray-500">Сыграть до {when(m.play_by)}</p>}
      {m.status === "reported" && (
        <p className="text-xs text-gray-400">
          {name(m.reported_winner)}: «моя победа». Засчитаем сами {when(m.confirm_by)}
        </p>
      )}
      {m.status === "disputed" && (
        <p className="text-xs text-amber-400">
          Спор. {name(m.reported_winner)}: «моя победа». {name(m.disputed_by)}: «это не так»
          {m.dispute_note ? `, «${m.dispute_note}»` : ""}
        </p>
      )}
      {open && m.player_a && m.player_b && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() => window.confirm(`Победа: ${name(m.player_a)}?`) && run(() => decideMatch(m.id, m.player_a))}
          >
            Победа: {name(m.player_a)}
          </button>
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() => window.confirm(`Победа: ${name(m.player_b)}?`) && run(() => decideMatch(m.id, m.player_b))}
          >
            Победа: {name(m.player_b)}
          </button>
          <button type="button" disabled={pending} className={btn} onClick={() => run(() => replayMatch(m.id))}>
            Переиграть
          </button>
          {m.status === "ready" && (
            <button type="button" disabled={pending} className={btn} onClick={() => run(() => extendMatch(m.id, 12))}>
              +12 ч
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminTournamentClient({ data, now }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(null);
  const { tournament: t, people, entries, matches, rounds } = data;

  const run = (fn) => {
    setMsg(null);
    start(async () => {
      const res = await fn();
      setMsg(res?.error ? { error: res.error } : { ok: "Готово" });
      router.refresh();
    });
  };

  const needs = matches.filter(
    (m) => m.status === "disputed" || (m.status === "ready" && m.play_by && new Date(m.play_by).getTime() < now)
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
          {t.status === "registration" && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                window.confirm(`Закрыть запись и собрать сетку из ${entries.length} игроков? Бот напишет каждому его соперника.`) &&
                run(() => startTournamentAction(t.id))
              }
              className="bg-acid-400 text-black font-bold rounded-lg px-3 py-2 text-sm disabled:opacity-50"
            >
              Запустить сетку
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
        </div>
        {msg?.error && <p className="text-xs text-red-400">{msg.error}</p>}
        {msg?.ok && <p className="text-xs text-acid-400">{msg.ok}</p>}
      </div>

      {needs.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-amber-400 px-1">Нужно решение · {needs.length}</p>
          {needs.map((m) => (
            <MatchAdmin key={m.id} m={m} people={people} rounds={rounds} pending={pending} run={run} now={now} />
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
                <p className="text-sm truncate">{people[e.userId]?.name ?? "—"}</p>
                <p className="text-[11px] text-gray-500 tabular-nums">
                  {people[e.userId]?.tag ?? "без тега"}
                  {e.status !== "active" ? ` · ${e.status === "winner" ? "победитель" : "выбыл"}` : ""}
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

      {rounds > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 px-1">Матчи</p>
          {matches
            .filter((m) => m.method !== "bye" && !needs.includes(m))
            .sort((a, b) => b.round - a.round || a.slot - b.slot)
            .map((m) => (
              <MatchAdmin key={m.id} m={m} people={people} rounds={rounds} pending={pending} run={run} now={now} />
            ))}
        </div>
      )}
    </div>
  );
}
