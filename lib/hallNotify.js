import { readConfigJson, writeConfigJson } from "@/lib/configStore";
import { computeHallOfFame, HISTORICAL_BEST_MONTH } from "@/lib/hallOfFame";
import { sendTelegramMessage } from "@/lib/telegramBot";
import { escapeHtml } from "@/lib/notifyUser";
import { almatyDayKey, formatPaymentDay, monthRangeAlmaty } from "@/lib/timezone";

// Объявление в командную группу, когда в Зале славы что-то побито.
// Состояние (какие рекорды уже известны) лежит JSON-файлом в закрытом
// бакете app-config, схема базы не меняется. Первый запуск только
// запоминает рекорды и ничего не рассылает.
const STATE_FILE = "hall-state.json";
// Версия правил подсчёта. Поднимаем, когда рекорды могли стать меньше
// (например, исключили оплаты из дня/недели): состояние тогда обновляется молча.
const SCHEMA_VERSION = 2;

const kzt = (n) => `${(Number(n) || 0).toLocaleString("ru-RU")} ₸`;
const noon = (key) => `${key}T12:00:00+05:00`;

// Свежая подписанная ссылка с меткой времени: обычное скачивание иногда
// отдаёт старую копию после перезаписи (так же сделано в programCost).
async function readState(admin) {
  return readConfigJson(admin, STATE_FILE, null);
}

async function saveState(admin, state) {
  const res = await writeConfigJson(admin, STATE_FILE, state);
  if (res.error) throw new Error(res.error);
}

// Текущие рекорды в простом виде: значение + «кто и когда» одной строкой
// (id), по которой отличаем новый рекорд от роста старого в тот же день.
function snapshot(hall) {
  const rec = {};
  const put = (key, r, id) => {
    if (!r) return;
    rec[key] = {
      value: r.value,
      id,
      name: r.name ?? null,
      when: r.when ?? null,
      at: r.at ?? null,
      weekEnd: r.weekEnd ?? null,
      inactive: r.inactive ?? false,
    };
  };
  put("bestDay", hall.bestDay, `${hall.bestDay?.userId}|${hall.bestDay?.when}`);
  put("bestWeek", hall.bestWeek, `${hall.bestWeek?.userId}|${hall.bestWeek?.when}`);
  put("bestMonth", hall.bestMonth, `${hall.bestMonth?.userId}|${hall.bestMonth?.when}`);
  put("bestPayment", hall.bestPayment, `${hall.bestPayment?.userId}|${hall.bestPayment?.at}`);
  put("companyMonth", hall.companyMonth, `${hall.companyMonth?.when}`);
  return rec;
}

function lineFor(key, r) {
  const who = escapeHtml(r.name ?? "Сотрудник");
  switch (key) {
    case "bestDay":
      return `Лучший день: ${who}, ${kzt(r.value)} (${formatPaymentDay(noon(r.when))})`;
    case "bestWeek":
      return `Лучшая неделя: ${who}, ${kzt(r.value)} (${formatPaymentDay(noon(r.when))} - ${formatPaymentDay(noon(r.weekEnd))})`;
    case "bestMonth":
      return `Лучший месяц человека: ${who}, ${kzt(r.value)} (${monthRangeAlmaty(r.when).label})`;
    case "bestPayment":
      return `Самая большая оплата: ${who}, ${kzt(r.value)} (${formatPaymentDay(r.at)})`;
    case "companyMonth":
      return `Лучший месяц компании: ${kzt(r.value)} (${monthRangeAlmaty(r.when).label})`;
    default:
      return null;
  }
}

export async function announceHallRecords(admin) {
  const hall = await computeHallOfFame();
  if (!hall?.bestDay) return { skipped: "no-data" };

  const now = snapshot(hall);
  const today = almatyDayKey(new Date());
  const old = await readState(admin).catch(() => null);

  // Первый запуск: только запоминаем, чтобы не объявлять все старые рекорды.
  if (!old?.records) {
    await saveState(admin, {
      records: now,
      lastSentDay: null,
      includesInactive: true,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    });
    return { first: true };
  }

  // Состояние со времён, когда уволенных не считали: рекорды могли вырасти
  // только из-за них. Обновляем молча, без рассылки.
  if (!old.includesInactive || old.schemaVersion !== SCHEMA_VERSION) {
    await saveState(admin, {
      records: now,
      lastSentDay: old.lastSentDay ?? null,
      includesInactive: true,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    });
    return { migrated: true };
  }

  const fresh = [];
  const next = { ...old.records };
  for (const [key, r] of Object.entries(now)) {
    const prev = old.records[key];
    // Рекорд у бывшего сотрудника: запоминаем молча (в том числе когда он ниже, чем было), объявляем только
    // рекорды активных.
    if (r.inactive) {
      if (!prev || r.value > prev.value) next[key] = r;
      continue;
    }
    // Рекорд компании за месяц объявляем, только если побита историческая
    // планка из таблицы; иначе запоминаем молча.
    if (key === "companyMonth" && r.value <= HISTORICAL_BEST_MONTH.amountKzt) {
      next[key] = r;
      continue;
    }
    if (prev && r.value <= prev.value) continue;
    // Тот же человек и тот же день/неделя/месяц, но сумма выросла: это
    // дорастание старого рекорда, не повод для нового сообщения.
    if (prev && prev.id === r.id) {
      next[key] = r;
    } else {
      fresh.push([key, r]);
      next[key] = r;
    }
  }

  if (!fresh.length) {
    if (JSON.stringify(next) !== JSON.stringify(old.records)) {
      await saveState(admin, { ...old, records: next, updatedAt: new Date().toISOString() });
    }
    return { sent: false };
  }

  // Не чаще одного сообщения в день: состояние не трогаем,
  // эти рекорды уйдут в следующий раз.
  if (old.lastSentDay === today) return { sent: false, waiting: true };

  const chatId = process.env.TELEGRAM_ANNOUNCE_CHAT_ID ?? process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!chatId) return { sent: false, skipped: "no-chat" };
  const thread = process.env.TELEGRAM_ANNOUNCE_THREAD_ID
    ? Number(process.env.TELEGRAM_ANNOUNCE_THREAD_ID)
    : undefined;

  const lines = fresh.map(([k, r]) => `• ${lineFor(k, r)}`);
  const text = `🏆 <b>Новые рекорды в Зале славы</b>\n\n${lines.join("\n")}\n\nВсе рекорды: Ещё, Зал славы`;
  const res = await sendTelegramMessage(chatId, text, undefined, thread, undefined, { silent: true });
  if (!res?.ok) return { sent: false, error: res?.description ?? "send failed" };

  await saveState(admin, { records: next, lastSentDay: today, includesInactive: true, schemaVersion: SCHEMA_VERSION, updatedAt: new Date().toISOString() });
  return { sent: true, count: fresh.length };
}
