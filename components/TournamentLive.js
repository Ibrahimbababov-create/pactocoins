"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase-browser";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import { roundLabel, leagueStandings, winsNeeded, battlesPlayed } from "@/lib/tournamentRounds";
import { MODE_NAME, MODE_LINE } from "@/lib/clashMode";

// Экран «Наблюдать за игрой»: открыть на ноутбуке и вывести на телевизор
// в офисе. Обновляется сам: база сообщает об изменениях сразу (Realtime),
// а на случай обрыва связи экран ещё и сам спрашивает раз в 10 секунд.

const POLL_MS = 10000;
const TOAST_MS = 6000;
const num = (v) => Number(v || 0).toLocaleString("ru-RU");
const hhmm = (v) => (v ? (formatDateTimeAlmaty(v).match(/\d{2}:\d{2}/)?.[0] ?? "") : "");
const nameOf = (people, id) => people[id]?.name ?? "Игрок";
// Ник в игре: по нему друг друга находят на арене.
const nickOf = (people, id) => people[id]?.inGame ?? null;
const loserOf = (m) => (m.winner_id === m.player_a ? m.player_b : m.player_a);
const whereOf = (m, rounds) => (m.round === 0 ? (m.tour ? `Тур ${m.tour}` : "Лига") : roundLabel(m.round, rounds));

// Сколько осталось: «1:24:05» в пределах суток, дальше «2 дн 4 ч».
function timeLeft(ms) {
  if (ms <= 0) return "время вышло";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} дн ${h} ч`;
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// Как засчитан матч — короткой подписью. Имена в именительном падеже,
// поэтому фразы построены так, чтобы их не надо было склонять.
const HOW = {
  loser_report: (l) => `${l} признаёт поражение`,
  confirmed: (l) => `${l} подтверждает`,
  auto_confirm: () => "засчитано автоматически",
  admin: () => "решение админа",
  walkover: () => "техническая победа",
  api: () => "по данным из игры",
};

// Серия плей-офф: счёт виден, если матч ещё идёт или его уже вели по боям
// (у старых матчей, сыгранных до счёта боёв, его нет).
const hasScore = (t, m) =>
  winsNeeded(t, m) > 1 &&
  m.method !== "bye" &&
  m.player_a &&
  m.player_b &&
  m.status !== "waiting" &&
  (m.status !== "done" || battlesPlayed(m) > 0);
// «2 : 1» в пользу победителя матча.
const finalScore = (m) => `${Math.max(m.wins_a ?? 0, m.wins_b ?? 0)} : ${Math.min(m.wins_a ?? 0, m.wins_b ?? 0)}`;

// Бои серии из журнала: каждый засчитанный бой, кроме последнего (его
// покажет победа в матче), и поправки счёта админом.
function battleItems(t, m, where) {
  const log = Array.isArray(m.battles) ? m.battles : [];
  if (winsNeeded(t, m) < 2 || !log.length) return [];
  const items = [];
  let a = 0;
  let b = 0;
  log.forEach((e, i) => {
    if (e.fix) {
      a = e.a;
      b = e.b;
      items.push({ id: `f-${m.id}-${i}`, at: e.at, kind: "fix", a: m.player_a, b: m.player_b, where, wa: a, wb: b, sub: "админ поправил счёт" });
      return;
    }
    if (e.winner === m.player_a) a++;
    else b++;
    const closes = m.status === "done" && i === log.length - 1;
    if (closes) return;
    items.push({
      id: `b-${m.id}-${i}`,
      at: e.at,
      kind: "battle",
      a: m.player_a,
      b: m.player_b,
      winner: e.winner,
      loser: e.winner === m.player_a ? m.player_b : m.player_a,
      where: `${where} · бой ${e.n}`,
      wa: a,
      wb: b,
    });
  });
  return items;
}

// Лента «кто когда нажал». Отдельной таблицы событий нет: всё видно по
// самим матчам (когда отметили победу, когда засчитали и как) и по журналу
// боёв серии.
function buildFeed(d) {
  const { tournament: t, people, entries, matches, rounds } = d;
  const n = (id) => nameOf(people, id);
  const items = [];
  for (const e of entries) {
    if (e.joinedAt) items.push({ id: `j-${e.userId}`, at: e.joinedAt, kind: "join", a: e.userId });
  }
  for (const m of matches) {
    if (m.method === "bye") continue;
    const where = whereOf(m, rounds);
    items.push(...battleItems(t, m, where));
    if (m.reported_at && m.reported_by) {
      const battle = winsNeeded(t, m) > 1 && m.status !== "done" ? ` · бой ${battlesPlayed(m) + 1}` : "";
      items.push({
        id: `r-${m.id}-${m.reported_at}`,
        at: m.reported_at,
        kind: "report",
        a: m.player_a,
        b: m.player_b,
        where: `${where}${battle}`,
        sub: `${n(m.reported_by)} сообщает о победе${
          m.status === "reported" ? ", ждём ответа" : m.status === "disputed" ? ", спор" : ""
        }`,
      });
    }
    if (m.status === "done" && m.winner_id && m.decided_at) {
      const l = n(loserOf(m));
      items.push({
        id: `d-${m.id}`,
        at: m.decided_at,
        kind: m.round > 0 && !m.next_match_id ? "final" : "win",
        a: m.winner_id,
        b: loserOf(m),
        winner: m.winner_id,
        where,
        sub: HOW[m.method]?.(l) ?? null,
        score: hasScore(t, m) ? finalScore(m) : null,
      });
    }
  }
  if (t.started_at) {
    items.push({
      id: "start",
      at: t.started_at,
      kind: "info",
      text: t.format === "league" ? "Лига началась" : "Турнир начался",
      sub: `играют ${entries.length}`,
    });
  }
  const first = matches.filter((m) => m.round === 1);
  const po = first
    .filter((m) => m.ready_at)
    .map((m) => m.ready_at)
    .sort()[0];
  if (t.format === "league" && po) {
    const out = [...new Set(first.flatMap((m) => [m.player_a, m.player_b]).filter(Boolean))].map(n);
    items.push({ id: "playoff", at: po, kind: "info", text: "Начался плей-офф", sub: `вышли: ${out.join(", ")}` });
  }
  return items.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
}

function toursOf(matches) {
  const map = new Map();
  for (const m of matches.filter((x) => x.round === 0)) {
    const k = m.tour ?? 1;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(m);
  }
  const list = [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tour, ms]) => ({ tour, matches: ms.sort((a, b) => a.slot - b.slot), done: ms.every((x) => x.status === "done") }));
  const current = list.find((x) => !x.done) ?? list[list.length - 1] ?? null;
  return { list, current };
}

function Panel({ title, right, className = "", children }) {
  return (
    <section className={`rounded-3xl border border-dark-600 bg-dark-800 p-3 lg:p-5 ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 px-1 pb-2 lg:pb-3">
          <p className="text-sm lg:text-xl font-semibold text-gray-300">{title}</p>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

// Таблица лиги. Строки стоят абсолютно и двигаются сдвигом, поэтому при
// смене мест строка плавно уезжает вверх или вниз, а не прыгает.
function LiveTable({ d, moves, flash, viewerId, className, title = "Таблица лиги", cutText = "выше черты выходят в плей-офф" }) {
  const { tournament: t, entries, matches, people } = d;
  const table = leagueStandings(
    entries.map((e) => e.userId),
    matches
  );
  const n = table.length;
  const cut = Math.min(t.playoff_size ?? 4, n);
  const gap = cut < n ? 30 : 0;
  const per = Math.max(1, n - 1);
  const league = matches.filter((m) => m.round === 0);
  const played = league.filter((m) => m.status === "done").length;
  const rowLg = `clamp(44px, calc((100vh - 400px) / ${Math.max(n, 1)}), 84px)`;

  return (
    <Panel
      className={className}
      title={title}
      right={
        <span className="text-xs lg:text-lg text-gray-500 tabular-nums">
          сыграно {played} из {league.length}
        </span>
      }
    >
      <div className="mx-1 mb-3 h-1.5 lg:h-2 rounded-full bg-dark-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-acid-400 transition-[width] duration-700"
          style={{ width: league.length ? `${(played / league.length) * 100}%` : 0 }}
        />
      </div>
      <div
        className="relative [--row:54px] lg:[--row:var(--row-lg)]"
        style={{ "--row-lg": rowLg, height: `calc(var(--row) * ${n} + ${gap}px)` }}
      >
        {cut < n && (
          <div
            className="absolute inset-x-0 flex items-center gap-2 px-2 text-[10px] lg:text-sm font-semibold text-acid-400"
            style={{ top: `calc(var(--row) * ${cut})`, height: gap }}
          >
            <span className="h-px flex-1 bg-acid-400/40" />
            {cutText}
            <span className="h-px flex-1 bg-acid-400/40" />
          </div>
        )}
        {table.map((r, i) => {
          const inZone = r.place <= cut;
          const mv = moves[r.userId];
          const mine = viewerId && r.userId === viewerId;
          return (
            <div
              key={r.userId}
              className="absolute inset-x-0 top-0 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: `translateY(calc(var(--row) * ${i} + ${i >= cut ? gap : 0}px))`, height: "var(--row)" }}
            >
              <div
                key={flash[r.userId] ?? "still"}
                className={`h-[calc(100%-6px)] flex items-center gap-3 lg:gap-4 px-3 lg:px-4 rounded-2xl ${
                  inZone ? "bg-acid-400/[0.08]" : ""
                } ${mine ? "ring-1 ring-acid-400/60" : ""} ${flash[r.userId] ? "live-flash" : ""}`}
              >
                <span
                  className={`flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 2xl:w-12 2xl:h-12 shrink-0 rounded-full font-display font-bold text-sm lg:text-lg 2xl:text-xl tabular-nums ${
                    r.place === 1 && r.wins > 0
                      ? "bg-acid-400 text-black"
                      : r.place <= 3 && r.wins > 0
                        ? "bg-acid-400/30 text-acid-400"
                        : inZone
                          ? "bg-dark-700 text-gray-200"
                          : "bg-dark-700/60 text-gray-500"
                  }`}
                >
                  {r.place}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={`truncate text-base lg:text-xl 2xl:text-3xl font-semibold ${
                        inZone ? "text-gray-100" : "text-gray-400"
                      }`}
                    >
                      {nameOf(people, r.userId)}
                    </span>
                    {mv && (
                      <span
                        className={`live-in shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 lg:px-2.5 py-0.5 text-[11px] lg:text-base font-bold ${
                          mv.dir === "up" ? "bg-acid-400 text-black" : "bg-dark-700 text-gray-400"
                        }`}
                      >
                        <Icon name="chevronDown" className={`w-3 h-3 lg:w-4 lg:h-4 ${mv.dir === "up" ? "rotate-180" : ""}`} />
                        {mv.by}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 lg:mt-2 flex h-1 lg:h-1.5 rounded-full bg-dark-700 overflow-hidden">
                    <span className="bg-acid-400 transition-[width] duration-700" style={{ width: `${(r.wins / per) * 100}%` }} />
                    <span className="bg-gray-600 transition-[width] duration-700" style={{ width: `${(r.losses / per) * 100}%` }} />
                  </span>
                </span>
                <span className="shrink-0 w-12 lg:w-14 2xl:w-20 text-center text-xs lg:text-base 2xl:text-xl tabular-nums text-gray-400">
                  {r.played}
                  <span className="text-gray-600">/{per}</span>
                </span>
                <span className="shrink-0 w-10 lg:w-12 2xl:w-16 text-right">
                  <span className="block font-display font-bold tabular-nums text-xl lg:text-3xl 2xl:text-4xl leading-none">{r.wins}</span>
                  <span className="block text-[10px] lg:text-sm text-gray-500 mt-0.5 tabular-nums">
                    {r.wins}–{r.losses}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end gap-3 px-3 lg:px-4 pt-1 text-[10px] lg:text-sm text-gray-600">
        <span className="w-12 lg:w-14 2xl:w-20 text-center">игр</span>
        <span className="w-10 lg:w-12 2xl:w-16 text-right">побед</span>
      </div>
    </Panel>
  );
}

function PairStatus({ m, people }) {
  if (m.status === "done") {
    const how = HOW[m.method]?.(nameOf(people, loserOf(m)));
    return <p className="text-[11px] lg:text-base text-gray-500 text-center mt-1">{how ?? "сыграно"}</p>;
  }
  if (m.status === "reported") {
    return (
      <p className="text-[11px] lg:text-base text-amber-400 text-center mt-1 animate-pulse">
        {nameOf(people, m.reported_by)} сообщает о победе, ждём ответа
      </p>
    );
  }
  if (m.status === "disputed") {
    return <p className="text-[11px] lg:text-base text-red-400 text-center mt-1">спор, решает админ</p>;
  }
  return <p className="text-[11px] lg:text-base text-gray-600 text-center mt-1">ещё не сыграли</p>;
}

function PairName({ id, m, people, align }) {
  const win = m.winner_id && m.winner_id === id;
  const lose = m.winner_id && !win;
  return (
    <span
      className={`flex items-center gap-1.5 min-w-0 ${align === "right" ? "justify-end text-right" : ""} ${
        win ? "text-acid-400 font-bold" : lose ? "text-gray-500" : "text-gray-100 font-semibold"
      }`}
    >
      {win && align === "right" && <Icon name="trophy" className="w-4 h-4 lg:w-6 lg:h-6 shrink-0" />}
      <span className="min-w-0">
        <span className="block truncate">{id ? nameOf(people, id) : "ждём"}</span>
        {id && nickOf(people, id) && (
          <span className="block truncate text-xs lg:text-xl font-normal text-gray-500">{nickOf(people, id)}</span>
        )}
      </span>
      {win && align !== "right" && <Icon name="trophy" className="w-4 h-4 lg:w-6 lg:h-6 shrink-0" />}
    </span>
  );
}

function Pair({ m, people }) {
  return (
    <div
      className={`rounded-2xl border px-3 lg:px-5 py-2.5 lg:py-4 ${
        m.status === "reported"
          ? "border-amber-400/50 bg-amber-400/[0.06]"
          : m.status === "disputed"
            ? "border-red-400/50"
            : m.status === "done"
              ? "border-dark-600 bg-dark-900/40"
              : "border-dark-600"
      }`}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 lg:gap-4 text-sm lg:text-2xl">
        <PairName id={m.player_a} m={m} people={people} align="left" />
        <span className="text-[10px] lg:text-sm text-gray-600">vs</span>
        <PairName id={m.player_b} m={m} people={people} align="right" />
      </div>
      <PairStatus m={m} people={people} />
    </div>
  );
}

// Текущий тур: пары и что с каждой. Туры задают порядок, а не время, поэтому
// ниже отдельно показываем матчи других туров, которые ждут ответа.
function TourPanel({ d, className }) {
  const { list, current } = toursOf(d.matches);
  if (!current) return null;
  const elsewhere = d.matches.filter(
    (m) => m.round === 0 && (m.tour ?? 1) !== current.tour && (m.status === "reported" || m.status === "disputed")
  );
  return (
    <Panel
      className={className}
      title={`Тур ${current.tour} из ${list.length}`}
      right={
        <span className="flex gap-1 lg:gap-1.5">
          {list.map((x) => (
            <span
              key={x.tour}
              className={`flex items-center justify-center w-6 h-6 lg:w-9 lg:h-9 rounded-full text-[11px] lg:text-base font-bold tabular-nums ${
                x.tour === current.tour
                  ? "bg-acid-400 text-black"
                  : x.done
                    ? "bg-acid-400/20 text-acid-400"
                    : "bg-dark-700 text-gray-500"
              }`}
            >
              {x.done && x.tour !== current.tour ? <Icon name="check" className="w-3 h-3 lg:w-4 lg:h-4" /> : x.tour}
            </span>
          ))}
        </span>
      }
    >
      <div className="space-y-2 lg:space-y-3">
        {current.matches.map((m) => (
          <Pair key={m.id} m={m} people={d.people} />
        ))}
      </div>
      {elsewhere.length > 0 && (
        <>
          <p className="px-1 pt-4 pb-2 text-xs lg:text-lg text-gray-500">Другие туры, ждут ответа</p>
          <div className="space-y-2 lg:space-y-3">
            {elsewhere.map((m) => (
              <Pair key={m.id} m={m} people={d.people} />
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

function BracketMatch({ t, m, people, final }) {
  const score = hasScore(t, m);
  const n = battlesPlayed(m) + 1;
  const line = (id) => {
    if (!id) return <span className="text-gray-600">{m.method === "bye" ? "без соперника" : "ждём"}</span>;
    const win = m.winner_id === id;
    const lose = m.winner_id && !win;
    const wins = id === m.player_a ? (m.wins_a ?? 0) : (m.wins_b ?? 0);
    // Кто ведёт в серии — его цифра горит, даже пока матч не закрыт.
    const leads = !m.winner_id && wins > (id === m.player_a ? (m.wins_b ?? 0) : (m.wins_a ?? 0));
    return (
      <span
        className={`flex items-center justify-between gap-2 min-w-0 ${
          win ? "text-acid-400 font-bold" : lose ? "text-gray-500" : "text-gray-100 font-semibold"
        }`}
      >
        <span className="min-w-0">
          <span className="block truncate">{nameOf(people, id)}</span>
          {nickOf(people, id) && (
            <span className="block truncate text-xs lg:text-xl font-normal text-gray-500">{nickOf(people, id)}</span>
          )}
        </span>
        <span className="flex items-center gap-2 lg:gap-3 shrink-0">
          {win && <Icon name="trophy" className="w-4 h-4 lg:w-6 lg:h-6 shrink-0" />}
          {score && (
            <span
              key={wins}
              className={`live-in font-display font-bold tabular-nums text-xl lg:text-4xl leading-none ${
                win || leads ? "text-acid-400" : lose ? "text-gray-600" : "text-gray-300"
              }`}
            >
              {wins}
            </span>
          )}
        </span>
      </span>
    );
  };
  const status =
    m.method === "bye"
      ? "проходит без игры"
      : m.status === "reported"
        ? `${score ? `бой ${n}: ` : ""}${nameOf(people, m.reported_by)} сообщает о победе`
        : m.status === "disputed"
          ? `${score ? `бой ${n}: ` : ""}спор, решает админ`
          : m.status === "ready"
            ? score
              ? `играют бой ${n}`
              : "играют"
            : m.status === "waiting"
              ? "ждём соперников"
              : null;
  return (
    <div
      className={`rounded-2xl border bg-dark-800 px-3 lg:px-5 py-2.5 lg:py-4 ${
        final ? "border-acid-400/60" : m.status === "reported" ? "border-amber-400/50" : "border-dark-600"
      } ${final && m.status === "done" ? "live-glow" : ""}`}
    >
      <div className="space-y-1 lg:space-y-2 text-sm lg:text-2xl">
        {line(m.player_a)}
        <span className="block h-px bg-dark-700" />
        {line(m.player_b)}
      </div>
      {status && (
        <p
          className={`mt-1.5 text-[11px] lg:text-base ${
            m.status === "reported" ? "text-amber-400 animate-pulse" : m.status === "disputed" ? "text-red-400" : "text-gray-500"
          }`}
        >
          {status}
        </p>
      )}
    </div>
  );
}

function LiveBracket({ d, className = "" }) {
  const { matches, rounds, people, tournament: t } = d;
  if (!rounds) return null;
  const cols = Array.from({ length: rounds }, (_, i) => i + 1).map((r) => ({
    r,
    list: matches.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot),
  }));
  return (
    <Panel
      className={`flex flex-col ${className}`}
      title="Плей-офф"
      right={t.playoff_wins > 1 ? <span className="text-xs lg:text-lg text-gray-500">матчи до {t.playoff_wins} побед</span> : null}
    >
      <div className="flex-1 flex justify-center gap-3 lg:gap-6 overflow-x-auto pb-1">
        {cols.map((c) => (
          <div key={c.r} className="flex-1 min-w-[180px] max-w-[460px] flex flex-col">
            <p className="text-center text-xs lg:text-xl text-gray-400 mb-2 lg:mb-4">{roundLabel(c.r, rounds)}</p>
            <div className="flex-1 flex flex-col justify-around gap-3 lg:gap-5">
              {c.list.map((m) => (
                <BracketMatch key={m.id} t={t} m={m} people={people} final={c.r === rounds} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function FeedLine({ it, people }) {
  const n = (id) => nameOf(people, id);
  if (it.kind === "join") return <span className="font-semibold">{n(it.a)} в турнире</span>;
  if (it.kind === "battle") {
    return (
      <span>
        <span className={it.winner === it.a ? "font-bold text-acid-400" : "text-gray-400"}>{n(it.a)}</span>{" "}
        <b className="font-display tabular-nums">
          {it.wa} : {it.wb}
        </b>{" "}
        <span className={it.winner === it.b ? "font-bold text-acid-400" : "text-gray-400"}>{n(it.b)}</span>
      </span>
    );
  }
  if (it.kind === "fix") {
    return (
      <span>
        {n(it.a)}{" "}
        <b className="font-display tabular-nums">
          {it.wa} : {it.wb}
        </b>{" "}
        {n(it.b)}
      </span>
    );
  }
  if (it.kind === "info") return <span className="font-semibold text-acid-400">{it.text}</span>;
  if (it.kind === "win" || it.kind === "final") {
    return (
      <span className="flex items-center gap-1.5 min-w-0">
        <Icon name="trophy" className="w-4 h-4 lg:w-5 lg:h-5 shrink-0 text-acid-400" />
        <span className="min-w-0">
          <b className="text-acid-400">{n(it.winner)}</b> <span className="text-gray-600">vs</span>{" "}
          <span className="text-gray-400">{n(it.b)}</span>
        </span>
      </span>
    );
  }
  return (
    <span>
      {n(it.a)} <span className="text-gray-600">vs</span> {n(it.b)}
    </span>
  );
}

function Feed({ items, fresh, people, className = "", limit = 14 }) {
  return (
    <Panel className={className} title="Что происходит">
      {items.length === 0 ? (
        <p className="px-1 py-6 text-sm lg:text-xl text-gray-500 text-center">Пока тихо. Первые результаты появятся здесь.</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, limit).map((it) => (
            <li
              key={it.id}
              className={`flex gap-3 rounded-xl px-2 lg:px-3 py-1.5 lg:py-2.5 ${fresh.has(it.id) ? "live-in live-flash" : ""}`}
            >
              <span className="w-11 lg:w-16 shrink-0 pt-0.5 text-xs lg:text-lg tabular-nums text-gray-500">{hhmm(it.at)}</span>
              <span className="min-w-0 flex-1 text-sm lg:text-xl">
                <FeedLine it={it} people={people} />
                {(it.where || it.sub) && (
                  <span className="block text-[11px] lg:text-base text-gray-500">
                    {[it.where, it.score && `серия ${it.score}`, it.sub].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Winner({ d }) {
  const { tournament: t, people } = d;
  return (
    <div className="live-glow rounded-3xl border-2 border-acid-400 bg-gradient-to-br from-acid-400/25 via-dark-800 to-dark-800 px-6 py-8 lg:py-12 text-center">
      <Icon name="trophy" className="w-14 h-14 lg:w-24 lg:h-24 mx-auto text-acid-400" />
      <p className="mt-3 text-sm lg:text-2xl text-gray-300">Победитель турнира</p>
      <p className="mt-1 font-display font-bold text-4xl lg:text-8xl break-words">{nameOf(people, t.winner_id)}</p>
      {t.pot > 0 && (
        <p className="mt-3 text-base lg:text-3xl text-gray-300">
          забирает <b className="font-display text-acid-400">{num(t.pot)}</b> коинов
        </p>
      )}
    </div>
  );
}

function Registration({ d }) {
  const { tournament: t, entries, people } = d;
  return (
    <div className="grid gap-4 lg:gap-6 lg:grid-cols-12 flex-1">
      <Panel className="lg:col-span-8">
        <div className="flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-sm lg:text-2xl text-gray-400">Уже в турнире</p>
            <p className="font-display font-bold text-5xl lg:text-8xl tabular-nums leading-none mt-1">
              {entries.length}
              {t.max_players ? <span className="text-gray-600">/{t.max_players}</span> : null}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm lg:text-2xl text-gray-400">Взнос</p>
            <p className="font-display font-bold text-2xl lg:text-5xl tabular-nums">{num(t.entry_fee)}</p>
          </div>
        </div>
        <div className="mt-5 lg:mt-8 flex flex-wrap gap-2 lg:gap-3">
          {entries.map((e) => (
            <span
              key={e.userId}
              className="live-in rounded-full border border-acid-400/40 bg-acid-400/10 px-3.5 lg:px-6 py-1.5 lg:py-3 text-sm lg:text-3xl font-semibold"
            >
              {nameOf(people, e.userId)}
              {nickOf(people, e.userId) && (
                <span className="ml-2 font-normal text-gray-400">{nickOf(people, e.userId)}</span>
              )}
            </span>
          ))}
          {!entries.length && <p className="text-sm lg:text-2xl text-gray-500">Пока никто не записался. Будь первым!</p>}
        </div>
      </Panel>
      <Panel className="lg:col-span-4" title="Как попасть в турнир">
        <ol className="space-y-3 lg:space-y-5 px-1">
          {[
            "Открой PactoCoins, вкладка «Игры»",
            "Нажми на турнир и впиши свой ник и тег из Clash Royale",
            t.entry_fee > 0 ? `«Участвовать»: ${num(t.entry_fee)} коинов уйдут в общий банк` : "Нажми «Участвовать»",
            t.bonus_coins > 0 ? `Pacto добавляет ${num(t.bonus_coins)}, победитель забирает всё` : "Победитель забирает весь банк",
            MODE_LINE,
          ].map((text, i) => (
            <li key={i} className="flex gap-3 text-sm lg:text-2xl text-gray-300">
              <span className="flex items-center justify-center w-7 h-7 lg:w-11 lg:h-11 shrink-0 rounded-full bg-acid-400/15 text-acid-400 text-xs lg:text-lg font-bold">
                {i + 1}
              </span>
              <span className="pt-0.5 lg:pt-1.5">{text}</span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

// Большая плашка снизу на каждую победу и на каждого нового участника.
function Toast({ it, d }) {
  const n = (id) => nameOf(d.people, id);
  let small;
  let big;
  let sub = null;
  if (it.kind === "info") {
    small = d.tournament.title;
    big = it.text;
    sub = it.sub ?? null;
  } else if (it.kind === "join") {
    small = "Новый участник";
    big = n(it.a);
    sub = `в банке ${num(d.tournament.pot)} коинов`;
  } else if (it.kind === "battle") {
    small = it.where;
    big = n(it.winner);
    sub = `${n(it.a)} ${it.wa} : ${it.wb} ${n(it.b)}`;
  } else if (it.kind === "final") {
    small = "Финал";
    big = `Победа: ${n(it.winner)}`;
    sub = `соперник: ${n(it.b)}${it.score ? ` · серия ${it.score}` : ""}`;
  } else {
    small = `${it.where} · победа`;
    big = n(it.winner);
    sub = `соперник: ${n(it.b)}${it.score ? ` · серия ${it.score}` : it.sub ? ` · ${it.sub}` : ""}`;
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 lg:bottom-12 z-[110] flex justify-center px-4">
      <div className="live-toast max-w-full rounded-3xl border-2 border-acid-400 bg-dark-800/95 px-6 py-4 lg:px-14 lg:py-8 text-center shadow-2xl">
        <p className="flex items-center justify-center gap-2 text-xs lg:text-2xl text-acid-400 font-semibold">
          <Icon name="trophy" className="w-4 h-4 lg:w-7 lg:h-7" />
          {small}
        </p>
        <p className="mt-1 font-display font-bold text-2xl lg:text-6xl truncate">{big}</p>
        {sub && <p className="mt-1 lg:mt-2 text-sm lg:text-2xl text-gray-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

export default function TournamentLive({ initial, apiUrl, backHref, viewerId = null }) {
  const [d, setD] = useState(initial);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [conn, setConn] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [fresh, setFresh] = useState(() => new Set());
  const [moves, setMoves] = useState({});
  const [flash, setFlash] = useState({});
  const [isFull, setIsFull] = useState(false);
  const tid = initial.tournament.id;

  // Один запрос за раз; если во время запроса пришло ещё изменение,
  // спрашиваем ещё раз сразу после.
  const loader = useRef({ busy: false, again: false, timer: null });
  const loadRef = useRef(null);
  loadRef.current = async () => {
    const l = loader.current;
    if (l.busy) {
      l.again = true;
      return;
    }
    l.busy = true;
    try {
      const res = await fetch(apiUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setD(await res.json());
      setConn(true);
    } catch {
      setConn(false);
    } finally {
      l.busy = false;
      if (l.again) {
        l.again = false;
        loadRef.current();
      }
    }
  };
  const soon = () => {
    clearTimeout(loader.current.timer);
    loader.current.timer = setTimeout(() => loadRef.current(), 400);
  };

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Подстраховка: раз в 10 секунд и при возвращении на вкладку.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadRef.current();
    }, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && loadRef.current();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Мгновенные обновления: база сама сообщает, что матч или участник изменился.
  useEffect(() => {
    const l = loader.current;
    let supabase = null;
    let channel;
    let alive = true;
    (async () => {
      // Не вышло подписаться — не беда, экран обновится по таймеру.
      try {
        supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!alive) return;
        if (session?.access_token) supabase.realtime.setAuth(session.access_token);
        channel = supabase
          .channel(`tournament-live-${tid}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${tid}` }, soon)
          .on("postgres_changes", { event: "*", schema: "public", table: "tournament_entries", filter: `tournament_id=eq.${tid}` }, soon)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tournaments", filter: `id=eq.${tid}` }, soon)
          .subscribe();
      } catch {
        channel = null;
      }
    })();
    return () => {
      alive = false;
      clearTimeout(l.timer);
      if (channel) supabase?.removeChannel(channel);
    };
    // soon читает только ref-ы, пересоздавать подписку не нужно
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid]);

  // Экран телевизора не должен гаснуть посреди турнира.
  useEffect(() => {
    let lock = null;
    const ask = async () => {
      try {
        lock = await navigator.wakeLock?.request("screen");
      } catch {
        lock = null;
      }
    };
    ask();
    const onVis = () => document.visibilityState === "visible" && ask();
    document.addEventListener("visibilitychange", onVis);
    const onFull = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFull);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", onFull);
      lock?.release?.().catch(() => {});
    };
  }, []);

  const feed = useMemo(() => buildFeed(d), [d]);

  // Что нового с прошлого раза: новые строки ленты, плашки побед,
  // кто поднялся или опустился в таблице.
  const seen = useRef(null);
  const prev = useRef(null);
  useEffect(() => {
    const ids = new Set(feed.map((f) => f.id));
    if (!seen.current) {
      seen.current = ids;
    } else {
      const added = feed.filter((f) => !seen.current.has(f.id));
      seen.current = ids;
      setFresh(new Set(added.map((f) => f.id)));
      const loud = added.filter((f) => ["win", "final", "join", "info", "battle"].includes(f.kind)).reverse();
      if (loud.length) setToasts((q) => [...q, ...loud].slice(-6));
    }

    if (d.tournament.format !== "league") return;
    const table = leagueStandings(
      d.entries.map((e) => e.userId),
      d.matches
    );
    const places = Object.fromEntries(table.map((r) => [r.userId, r]));
    if (prev.current) {
      const mv = {};
      const fl = {};
      for (const r of table) {
        const was = prev.current[r.userId];
        if (!was) continue;
        if (was.place !== r.place) mv[r.userId] = { dir: r.place < was.place ? "up" : "down", by: Math.abs(was.place - r.place) };
        if (r.wins > was.wins) fl[r.userId] = Date.now();
      }
      if (Object.keys(mv).length) setMoves(mv);
      if (Object.keys(fl).length) setFlash((f) => ({ ...f, ...fl }));
    }
    prev.current = places;
  }, [feed, d]);

  // Стрелки «поднялся/опустился» держим 10 секунд.
  useEffect(() => {
    if (!Object.keys(moves).length) return undefined;
    const id = setTimeout(() => setMoves({}), 10000);
    return () => clearTimeout(id);
  }, [moves]);

  const toast = toasts[0] ?? null;
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToasts((q) => q.slice(1)), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  if (!mounted) return null;

  const t = d.tournament;
  const isLeague = t.format === "league";
  const { list: tours, current } = toursOf(d.matches);
  const leagueStage = isLeague && d.stage === "league";

  let status = "Скоро старт";
  let deadline = null;
  let deadlineLabel = null;
  if (t.status === "registration") {
    status = "Идёт запись";
    deadline = t.registration_ends_at;
    deadlineLabel = "до конца записи";
  } else if (t.status === "running" && leagueStage) {
    status =
      current && !current.done
        ? `Идёт лига · тур ${current.tour} из ${tours.length}`
        : tours.length
          ? "Лига сыграна, скоро плей-офф"
          : "Идёт лига";
    deadline = t.league_ends_at;
    deadlineLabel = "до конца лиги";
  } else if (t.status === "running") {
    status = `Плей-офф${t.playoff_wins > 1 ? ` · до ${t.playoff_wins} побед` : ""}`;
  } else if (t.status === "finished") {
    status = "Турнир завершён";
  } else if (t.status === "cancelled") {
    status = "Турнир отменён";
  }
  const live = t.status === "registration" || t.status === "running";
  const deadlineMs = deadline ? new Date(deadline).getTime() - now : null;

  let body;
  if (t.status === "registration") {
    body = <Registration d={d} />;
  } else if (t.status === "running" && leagueStage) {
    body = (
      <div className="grid gap-4 lg:gap-6 lg:grid-cols-12 items-start">
        <LiveTable d={d} moves={moves} flash={flash} viewerId={viewerId} className="lg:col-span-5" />
        <TourPanel d={d} className="lg:col-span-4" />
        <Feed items={feed} fresh={fresh} people={d.people} className="lg:col-span-3 lg:max-h-[calc(100vh-15rem)] lg:overflow-hidden lg:[mask-image:linear-gradient(to_bottom,black_88%,transparent)]" />
      </div>
    );
  } else if (t.status === "running" || t.status === "finished") {
    const done = t.status === "finished";
    // В плей-офф таблица лиги остаётся на экране рядом с сеткой.
    const withTable = isLeague && d.rounds > 0 && d.matches.some((m) => m.round === 0);
    const main = d.rounds > 0 ? (
      <>
        <LiveBracket
          d={d}
          className={`${withTable ? "lg:col-span-5" : "lg:col-span-8"} ${done ? "" : "lg:min-h-[calc(100vh-15rem)]"}`}
        />
        {withTable && (
          <LiveTable
            d={d}
            moves={moves}
            flash={flash}
            viewerId={viewerId}
            title="Итоги лиги"
            cutText="вышли в плей-офф"
            className="lg:col-span-4"
          />
        )}
      </>
    ) : isLeague ? (
      <LiveTable d={d} moves={moves} flash={flash} viewerId={viewerId} className="lg:col-span-8" />
    ) : null;
    body = (
      <div className="space-y-4 lg:space-y-6">
        {t.status === "finished" && t.winner_id && <Winner d={d} />}
        <div className="grid gap-4 lg:gap-6 lg:grid-cols-12 items-start">
          {main}
          <Feed
            items={feed}
            fresh={fresh}
            people={d.people}
            limit={done ? 6 : 14}
            className={`${withTable ? "lg:col-span-3" : main ? "lg:col-span-4" : "lg:col-span-12"} ${done ? "" : "lg:max-h-[calc(100vh-15rem)] lg:overflow-hidden lg:[mask-image:linear-gradient(to_bottom,black_88%,transparent)]"}`}
          />
        </div>
      </div>
    );
  } else {
    body = (
      <p className="py-20 text-center text-lg lg:text-3xl text-gray-400">
        {t.status === "cancelled" ? "Турнир отменён, взносы вернули на баланс." : "Скоро здесь начнётся турнир."}
      </p>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-dark-900 text-gray-100">
      <div className="min-h-full flex flex-col gap-4 lg:gap-6 px-4 py-4 lg:px-10 lg:py-8">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 lg:gap-5 min-w-0">
            <Link
              href={backHref}
              aria-label="Закрыть"
              className="mt-1 flex items-center justify-center w-9 h-9 lg:w-12 lg:h-12 shrink-0 rounded-full border border-dark-600 text-gray-400"
            >
              <Icon name="x" className="w-5 h-5 lg:w-6 lg:h-6" />
            </Link>
            <div className="min-w-0">
              <p className="text-xs lg:text-lg text-gray-500">
                Clash Royale · {MODE_NAME.toLowerCase()} · {hhmm(now)}
              </p>
              <h1 className="font-display font-bold text-xl lg:text-5xl leading-tight truncate">{t.title}</h1>
              <p className="mt-1 lg:mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs lg:text-xl">
                <span className={`inline-flex items-center gap-2 font-semibold ${live ? "text-acid-400" : "text-gray-400"}`}>
                  {live && <span className="w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-acid-400 animate-pulse" />}
                  {status}
                </span>
                {deadlineMs !== null && (
                  <span className="text-gray-400">
                    {deadlineLabel} <b className="text-gray-100 tabular-nums">{timeLeft(deadlineMs)}</b>
                  </span>
                )}
                {!conn && <span className="text-red-400">нет связи, переподключаемся</span>}
              </p>
            </div>
          </div>
          <div className={`text-right shrink-0 ${t.pot > 0 || live ? "" : "invisible"}`}>
            <p className="text-xs lg:text-xl text-gray-500">Банк</p>
            <p className="font-display font-bold text-3xl lg:text-7xl text-acid-400 tabular-nums leading-none mt-0.5">
              {num(t.pot)}
            </p>
            <p className="text-[11px] lg:text-lg text-gray-500 mt-1">коинов победителю</p>
            {!isFull && (
              <button
                type="button"
                onClick={() => document.documentElement.requestFullscreen?.()?.catch(() => {})}
                className="hidden lg:inline-block mt-3 rounded-full border border-dark-600 px-4 py-1.5 text-sm text-gray-400"
              >
                На весь экран
              </button>
            )}
          </div>
        </header>
        {body}
      </div>
      {toast && <Toast key={toast.id} it={toast} d={d} />}
    </div>,
    document.body
  );
}
