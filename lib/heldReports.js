import { createAdminClient } from "@/lib/supabase-admin";
import { readConfigJson, updateConfigJson } from "@/lib/configStore";
import { getEarningsForRange } from "@/lib/weeklyMonthlyReport";
import { buildEarningsReportPdf } from "@/lib/pdfReport";
import { sendTelegramDocument, sendTelegramMessage } from "@/lib/telegramBot";
import { escapeHtml } from "@/lib/notifyUser";
import { sendWeeklyRatingSummary } from "@/lib/ratingNotify";
import { plural } from "@/lib/plural";
import {
  almatyDayKey,
  formatPaymentDay,
  lastWeekRangeAlmaty,
  lastMonthRangeAlmaty,
} from "@/lib/timezone";

// Недельный и месячный отчёты не уходят, пока за период есть необработанные
// заявки на выручку: иначе оплата, пришедшая в воскресенье в 23:50, не попадала
// в отчёт. Состояние («что уже отправлено») лежит в app-config/reports-state.json.
// Схему базы не трогаем.

const STATE_PATH = "reports-state.json";
// Через столько часов после конца периода отчёт уходит в любом случае:
// одна забытая заявка не должна блокировать его навсегда.
const FORCE_AFTER_MS = 72 * 3600 * 1000;
// «Отправляется» старше этого срока считаем упавшей попыткой.
const SENDING_STALE_MS = 10 * 60 * 1000;
// Периоды, закрытые раньше этого, при первом запуске считаются уже отправленными
// старой системой (крон в 00:05 шлёт отчёт сразу после конца периода).
const LEGACY_AFTER_MS = 12 * 3600 * 1000;
// Отчёт «созревает» в 10:00 по Алматы в день после конца периода (конец
// периода: 00:00 понедельника или 1-го числа): люди вносят оплату «вчера»
// и позже, около 12:40, поэтому окно сдвинуто.
const MATURE_AFTER_MS = 10 * 3600 * 1000;
const isMature = (p) => Date.now() >= new Date(p.end).getTime() + MATURE_AFTER_MS;
const QUEUE_URL = "https://pactocoins.vercel.app/admin/revenue-requests";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Последние закрытые неделя и месяц (по Алматы).
function candidatePeriods() {
  const w = lastWeekRangeAlmaty();
  const m = lastMonthRangeAlmaty();
  return [
    {
      key: `week:${almatyDayKey(w.start)}`,
      kind: "week",
      ...w,
      title: `Отчёт PactoCoins — неделя ${w.label}`,
      caption: `📊 Отчёт за неделю ${w.label}`,
      filename: `pactocoins-week-${w.label}.pdf`,
      what: "Недельный итог",
    },
    {
      // Личные итоги недели сотрудникам: те же неделя, условие и правила.
      key: `personal:${almatyDayKey(w.start)}`,
      kind: "personal",
      ...w,
      what: "Личные итоги недели",
    },
    {
      key: `month:${almatyDayKey(m.start).slice(0, 7)}`,
      kind: "month",
      ...m,
      title: `Отчёт PactoCoins — ${m.label}`,
      caption: `📊 Отчёт за ${m.label}`,
      filename: `pactocoins-${m.label.replace(" ", "-")}.pdf`,
      what: "Месячный итог",
    },
  ];
}

// Необработанные заявки на выручку с датой оплаты внутри периода.
async function pendingInPeriod(admin, { start, end }) {
  const cols = "id, user_id, amount_kzt, earned_at, created_at";
  const [{ data: byEarned, error: e1 }, { data: noEarned, error: e2 }] = await Promise.all([
    admin
      .from("revenue_requests")
      .select(cols)
      .eq("status", "pending")
      .gte("earned_at", start)
      .lt("earned_at", end),
    admin
      .from("revenue_requests")
      .select(cols)
      .eq("status", "pending")
      .is("earned_at", null)
      .gte("created_at", start)
      .lt("created_at", end),
  ]);
  // Не смогли проверить очередь: лучше не слать отчёт, чем слать без проверки.
  if (e1 || e2) throw new Error((e1 ?? e2).message);
  return [...(byEarned ?? []), ...(noEarned ?? [])].sort(
    (a, b) => new Date(a.earned_at ?? a.created_at) - new Date(b.earned_at ?? b.created_at)
  );
}

function reportTargets() {
  const chatId =
    process.env.TELEGRAM_ANNOUNCE_CHAT_ID ?? process.env.TELEGRAM_GROUP_CHAT_ID;
  const threadId = process.env.TELEGRAM_ANNOUNCE_THREAD_ID
    ? Number(process.env.TELEGRAM_ANNOUNCE_THREAD_ID)
    : undefined;
  return { chatId, threadId };
}

// Служебные сообщения админу: туда же, где лежат карточки заявок.
async function sendAdminNote(text) {
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!chatId) return;
  const threadId = process.env.TELEGRAM_REQUESTS_THREAD_ID
    ? Number(process.env.TELEGRAM_REQUESTS_THREAD_ID)
    : undefined;
  await sendTelegramMessage(chatId, text, undefined, threadId, undefined, { silent: true });
}

const requestsWord = (n) => plural(n, "заявка", "заявки", "заявок");

async function reminderText(admin, period, pending) {
  const ids = [...new Set(pending.map((r) => r.user_id))];
  const { data: users } = await admin.from("users").select("id, name").in("id", ids);
  const names = new Map((users ?? []).map((u) => [u.id, u.name]));
  const lines = pending.slice(0, 10).map(
    (r) =>
      `• ${escapeHtml(names.get(r.user_id) ?? "Сотрудник")}: ${Number(r.amount_kzt).toLocaleString("ru-RU")} ₸, оплата ${formatPaymentDay(r.earned_at ?? r.created_at)}`
  );
  const more = pending.length > 10 ? `\nи ещё ${pending.length - 10}` : "";
  return (
    `⏳ <b>${period.what} ждёт: ${pending.length} ${requestsWord(pending.length)} на выручку не обработаны.</b>\n` +
    `Подтверди или отклони, и отчёт уйдёт сам.\n\n` +
    `${lines.join("\n")}${more}\n\n` +
    `Очередь: ${QUEUE_URL}`
  );
}

// Первый запуск после выкатки: старые отчёты уже ушли прежним кроном,
// «пропущенными» их считать нельзя. Закрытые давно периоды помечаем отправленными.
async function ensureInitialized(admin, periods) {
  const now = Date.now();
  const res = await updateConfigJson(admin, STATE_PATH, (cur) => {
    if (cur) return cur;
    const state = { initializedAt: new Date().toISOString(), periods: {} };
    for (const p of periods) {
      if (now - new Date(p.end).getTime() > LEGACY_AFTER_MS) {
        state.periods[p.key] = { status: "sent", legacy: true, at: state.initializedAt };
      }
    }
    return state;
  });
  return !res.error;
}

// Захват периода: сначала пишем «sending» со своей меткой, потом перечитываем:
// если метка наша, отправляем. Параллельный вызов увидит чужую метку и уйдёт.
async function claimPeriod(admin, key) {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let claimed = false;
  const res = await updateConfigJson(admin, STATE_PATH, (cur) => {
    const state = cur ?? { initializedAt: new Date().toISOString(), periods: {} };
    state.periods = state.periods ?? {};
    const e = state.periods[key];
    const fresh = e?.status === "sending" && Date.now() - (e.sendingAt ?? 0) < SENDING_STALE_MS;
    if (e?.status === "sent" || fresh) {
      claimed = false;
      return state;
    }
    claimed = true;
    state.periods[key] = { ...e, status: "sending", token, sendingAt: Date.now() };
    return state;
  });
  if (res.error || !claimed) return null;
  await sleep(600);
  const after = await readConfigJson(admin, STATE_PATH, null);
  return after?.periods?.[key]?.token === token ? token : null;
}

async function finishPeriod(admin, key, token, { ok, forcedPending }) {
  await updateConfigJson(admin, STATE_PATH, (cur) => {
    const state = cur ?? { periods: {} };
    const e = state.periods?.[key];
    if (!e || e.token !== token) return state;
    if (ok) {
      state.periods[key] = {
        status: "sent",
        sentAt: new Date().toISOString(),
        lastReminderDay: e.lastReminderDay,
        ...(forcedPending ? { forcedPending } : {}),
      };
    } else {
      // Не вышло: откатываем, следующий запуск попробует снова.
      const { status, token: _t, sendingAt, ...rest } = e;
      if (Object.keys(rest).length) state.periods[key] = rest;
      else delete state.periods[key];
    }
    return state;
  });
}

async function sendReport(period, forcedPending, admin) {
  if (period.kind === "personal") {
    await sendWeeklyRatingSummary(admin);
    return;
  }
  const { chatId, threadId } = reportTargets();
  if (!chatId) throw new Error("Не задан чат для отчётов");
  const rows = await getEarningsForRange({ start: period.start, end: period.end });
  const note = forcedPending ? `ещё не обработаны: ${forcedPending} ${requestsWord(forcedPending)}` : undefined;
  const pdf = await buildEarningsReportPdf({ title: period.title, rows, note });
  const result = await sendTelegramDocument(
    chatId,
    pdf,
    period.filename,
    forcedPending ? `${period.caption}\n⚠️ ${note}` : period.caption,
    "application/pdf",
    threadId
  );
  if (!result?.ok) throw new Error(result?.description ?? "Telegram не принял отчёт");
}

// Основная работа: вызывается кроном отчётов (05:00 UTC = 10:00 Алматы) и маршрутом после обработки
// заявки. remind=true: напомнить админу (не чаще раза в сутки).
export async function runHeldReports({ remind = false } = {}) {
  const admin = createAdminClient();
  const periods = candidatePeriods();
  const out = { weeklyReportSent: false, monthlyReportSent: false, held: [] };

  if (!(await ensureInitialized(admin, periods))) return out;
  const today = almatyDayKey(new Date());

  for (const period of periods) {
    const state = await readConfigJson(admin, STATE_PATH, null);
    if (!state) return out; // не смогли прочитать состояние: лучше не слать, чем слать дубль
    const entry = state.periods?.[period.key];
    if (entry?.status === "sent") continue;
    if (!isMature(period)) continue;

    const pending = await pendingInPeriod(admin, period);
    const overdue = Date.now() - new Date(period.end).getTime() > FORCE_AFTER_MS;

    if (pending.length && !overdue) {
      out.held.push({ key: period.key, pending: pending.length });
      if (remind && period.kind !== "personal" && entry?.lastReminderDay !== today) {
        // Отметка до отправки: два параллельных запуска не напомнят дважды.
        let mine = false;
        await updateConfigJson(admin, STATE_PATH, (cur) => {
          const s = cur ?? { periods: {} };
          s.periods = s.periods ?? {};
          const e = s.periods[period.key] ?? {};
          if (e.lastReminderDay === today || e.status === "sent") return s;
          mine = true;
          s.periods[period.key] = { ...e, lastReminderDay: today };
          return s;
        });
        if (mine) {
          try {
            await sendAdminNote(await reminderText(admin, period, pending));
          } catch (err) {
            console.error("[reports] reminder failed:", err);
          }
        }
      }
      continue;
    }

    const token = await claimPeriod(admin, period.key);
    if (!token) continue;
    const forcedPending = pending.length;
    try {
      await sendReport(period, forcedPending, admin);
      await finishPeriod(admin, period.key, token, { ok: true, forcedPending });
      if (period.kind === "week") out.weeklyReportSent = true;
      else if (period.kind === "month") out.monthlyReportSent = true;
      else out.personalSummariesSent = true;
      if (forcedPending && period.kind !== "personal") {
        try {
          await sendAdminNote(
            `⚠️ ${period.what} ушёл без ожидания: прошло больше трёх суток, а ${forcedPending} ${requestsWord(forcedPending)} на выручку так и не обработаны. В отчёте они не учтены. Очередь: ${QUEUE_URL}`
          );
        } catch {}
      }
    } catch (err) {
      console.error("[reports] send failed:", err);
      await finishPeriod(admin, period.key, token, { ok: false });
    }
  }
  return out;
}

// Лучшая попытка после обработки заявки на выручку (админка и Telegram).
// Быстрая проверка без PDF; если какой-то отчёт готов, просим маршрут его
// отправить (PDF и шрифты собираются там). Любая ошибка проглатывается.
export async function maybeSendHeldReports() {
  try {
    if (process.env.VERCEL_ENV !== "production" || !process.env.CRON_SECRET) return;
    const admin = createAdminClient();
    const state = await readConfigJson(admin, STATE_PATH, null);
    if (!state) return; // ещё не инициализировано кроном
    let ready = false;
    for (const period of candidatePeriods()) {
      if (state.periods?.[period.key]?.status === "sent") continue;
      if (!isMature(period)) continue;
      const overdue = Date.now() - new Date(period.end).getTime() > FORCE_AFTER_MS;
      if (overdue || !(await pendingInPeriod(admin, period)).length) {
        ready = true;
        break;
      }
    }
    if (!ready) return;
    const base = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || "pactocoins.vercel.app"}`;
    await fetch(`${base}/api/reports/held`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      signal: AbortSignal.timeout(45000),
    });
  } catch (err) {
    console.error("[reports] maybeSendHeldReports failed:", err);
  }
}
