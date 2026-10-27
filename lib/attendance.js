import { createAdminClient } from "@/lib/supabase-admin";
import { BONUS_CATEGORIES } from "@/lib/bonusCategories";
import { sendTelegramMessage, setTelegramReaction, clearTelegramButtons } from "@/lib/telegramBot";
import { escapeHtml } from "@/lib/notifyUser";
import { spinsNom } from "@/lib/plural";
import { almatyDayKey } from "@/lib/timezone";
import { approveAttendanceWithChest } from "@/lib/telegramApprovals";
import { TEAM_CHAT_ID } from "@/lib/teamGroup";

// «Приход вовремя» по кружку. Пришёл на работу — кидаешь кружок в тему
// «Приступил вовремя к работе» рабочей группы. Бот смотрит на время
// кружка: успел до своего времени — крутка начисляется сама, Ибрагиму
// жать ничего не нужно; позже — заявка уходит ему на решение, как раньше.
// Без кружка приход не засчитывается никогда.
//
// Графики у ребят разные, поэтому кроме общего времени у каждого может
// быть своё (админка → «Приход вовремя»). Настройки лежат JSON-файлом в
// закрытом бакете, как ссылки на таблицы у «Сверки»: схема базы не меняется.

const BUCKET = "app-config";
const FILE = "attendance.json";

// until — до скольки включительно приход засчитывается сам;
// threadId — тема «Приступил вовремя к работе» (t.me/c/3065195919/5059);
// people — { [userId]: "12:00" } своё время, "off" — всё на решение админу.
export const ATTENDANCE_DEFAULTS = { until: "11:15", threadId: 5059, people: {} };
export const ATTENDANCE_OFF = "off";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isClock = (v) => TIME_RE.test(String(v ?? ""));

const ROLES = new Set(["mop", "rop", "trainee", "mentor"]);

export async function getAttendanceConfig(admin) {
  try {
    const { data, error } = await admin.storage.from(BUCKET).download(FILE);
    if (error || !data) return { ...ATTENDANCE_DEFAULTS, updatedAt: null };
    const parsed = JSON.parse(await data.text());
    const people = {};
    for (const [id, v] of Object.entries(parsed?.people ?? {})) {
      if (isClock(v) || v === ATTENDANCE_OFF) people[id] = v;
    }
    return {
      until: isClock(parsed?.until) ? parsed.until : ATTENDANCE_DEFAULTS.until,
      threadId: Number(parsed?.threadId) || ATTENDANCE_DEFAULTS.threadId,
      people,
      updatedAt: parsed?.updatedAt ?? null,
    };
  } catch {
    return { ...ATTENDANCE_DEFAULTS, updatedAt: null };
  }
}

export async function saveAttendanceConfig(admin, config) {
  const { data: buckets } = await admin.storage.listBuckets();
  if (!(buckets ?? []).some((b) => b.id === BUCKET)) {
    const { error } = await admin.storage.createBucket(BUCKET, { public: false });
    if (error && !/exists/i.test(error.message)) return { error: error.message };
  }
  const body = JSON.stringify({ ...config, updatedAt: new Date().toISOString() }, null, 2);
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(FILE, body, { contentType: "application/json", upsert: true });
  return error ? { error: error.message } : { ok: true };
}

// До скольки человеку засчитывается само. null — никогда, всё на решение.
export function limitFor(config, userId) {
  const own = config.people?.[userId];
  if (own === ATTENDANCE_OFF) return null;
  return isClock(own) ? own : config.until;
}

// «09:52» по Алматы.
export const almatyClock = (date) =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);

// Границы дня по Алматы (UTC+5) для момента date.
export function almatyDayRange(date) {
  const [y, m, d] = almatyDayKey(date).split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, d, -5)).toISOString(),
    end: new Date(Date.UTC(y, m - 1, d + 1, -5)).toISOString(),
  };
}

// Приход за день уже есть (на проверке или засчитан)? Отклонённые не в счёт.
export async function attendanceToday(admin, userId, date = new Date()) {
  const { start, end } = almatyDayRange(date);
  const { data } = await admin
    .from("bonus_requests")
    .select("id, status, created_at, admin_chat_id, admin_message_id")
    .eq("user_id", userId)
    .eq("category", "attendance")
    .in("status", ["pending", "approved"])
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at");
  return data ?? [];
}

const requestsThread = () =>
  process.env.TELEGRAM_REQUESTS_THREAD_ID ? Number(process.env.TELEGRAM_REQUESTS_THREAD_ID) : undefined;

// Ответ под карточкой заявки в группе заявок.
const replyToCard = (r, text) =>
  sendTelegramMessage(r.admin_chat_id, text, undefined, requestsThread(), r.admin_message_id);

// Заявка на бонус — в группу заявок с кнопками. Одно место и для заявок
// из приложения, и для опозданий, которые бот разглядел по кружку.
export async function sendBonusForReview(admin, request, name) {
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!groupChatId) return null;
  const meta = BONUS_CATEGORIES[request.category] ?? {};
  const text =
    `🎯 <b>Новая заявка на бонус</b>\n\n` +
    `От: <b>${escapeHtml(name ?? "МОП")}</b>\n` +
    `Повод: ${meta.label ?? escapeHtml(request.category)}\n` +
    (meta.spin
      ? `Награда: 🎡 ${meta.spins} ${spinsNom(meta.spins)} на колесе\n`
      : `Коинов: ${request.amount_coins}\n`) +
    (request.comment ? `Комментарий: ${escapeHtml(request.comment)}\n` : "");

  const threadId = requestsThread();

  const tgResult = await sendTelegramMessage(
    groupChatId,
    text,
    {
      inline_keyboard: [
        [
          { text: "✅ Подтвердить", callback_data: `approve_bonus:${request.id}` },
          { text: "❌ Отклонить", callback_data: `reject_bonus:${request.id}` },
        ],
      ],
    },
    threadId
  );

  // Message id нужен, чтобы потом узнать реплай админа на это
  // сообщение и подтянуть его текст как комментарий к одобрению.
  if (tgResult?.result?.message_id) {
    await admin
      .from("bonus_requests")
      .update({ admin_chat_id: groupChatId, admin_message_id: tgResult.result.message_id })
      .eq("id", request.id);
  }
  return tgResult;
}

// Кружок в теме прихода. true — сообщение наше, дальше не разбирать.
export async function handleAttendanceVideoNote(msg) {
  if (!msg?.video_note || !msg.from?.id) return false;
  if (String(msg.chat?.id) !== String(TEAM_CHAT_ID)) return false;

  const admin = createAdminClient();
  const config = await getAttendanceConfig(admin);
  if (Number(msg.message_thread_id) !== Number(config.threadId)) {
    console.log("[attendance] кружок не в теме прихода, тема", msg.message_thread_id ?? "General");
    return false;
  }

  // Пересланный кружок — это старое видео, а не приход сегодня.
  if (msg.forward_origin || msg.forward_date || msg.forward_from) {
    await setTelegramReaction(msg.chat.id, msg.message_id, "🤨");
    return true;
  }

  const { data: user } = await admin
    .from("users")
    .select("id, name, role, is_active, is_guest, email")
    .eq("telegram_id", msg.from.id)
    .maybeSingle();
  if (
    !user ||
    !user.is_active ||
    user.is_guest ||
    !ROLES.has(user.role) ||
    /\.test@pactocoins\.local$/.test(user.email ?? "")
  ) {
    return true;
  }

  const at = new Date(msg.date * 1000);
  const clock = almatyClock(at);
  const limit = limitFor(config, user.id);
  const onTime = limit !== null && clock <= limit;

  const existing = await attendanceToday(admin, user.id, at);
  if (existing.some((r) => r.status === "approved")) return true;

  // Человек уже подал заявку в приложении, а кружок пришёл следом.
  const pending = existing.find((r) => r.status === "pending");
  if (pending) {
    if (onTime) {
      const res = await approveAttendanceWithChest(pending.id);
      if (res?.success) {
        await setTelegramReaction(msg.chat.id, msg.message_id, "👍");
        if (pending.admin_chat_id && pending.admin_message_id) {
          await clearTelegramButtons(pending.admin_chat_id, pending.admin_message_id);
          await replyToCard(pending, `✅ Засчитано само: кружок в ${clock}, время до ${limit}.`);
        }
      }
    } else if (pending.admin_chat_id && pending.admin_message_id) {
      // Решать всё равно админу, но уже с временем кружка перед глазами.
      await replyToCard(
        pending,
        limit ? `Кружок в ${clock}, а время до ${limit}.` : `Кружок в ${clock}. Сам не засчитывается, решай.`
      );
      await setTelegramReaction(msg.chat.id, msg.message_id, "👀");
    }
    return true;
  }

  const comment = onTime
    ? `Кружок в ${clock}, засчитано само (время до ${limit})`
    : limit
      ? `Кружок в ${clock}, а время до ${limit}`
      : `Кружок в ${clock}, сам не засчитывается`;

  const { data: request, error } = await admin
    .from("bonus_requests")
    .insert({
      user_id: user.id,
      category: "attendance",
      amount_coins: BONUS_CATEGORIES.attendance.amount,
      comment,
      status: "pending",
    })
    .select()
    .single();
  if (error || !request) {
    console.error("[attendance] не удалось создать заявку", error);
    return true;
  }

  // Два кружка подряд дошли одновременно — оставляем только первую заявку.
  const now = await attendanceToday(admin, user.id, at);
  if (now[0] && now[0].id !== request.id) {
    await admin.from("bonus_requests").delete().eq("id", request.id).eq("status", "pending");
    return true;
  }

  if (onTime) {
    const res = await approveAttendanceWithChest(request.id);
    if (res?.success) await setTelegramReaction(msg.chat.id, msg.message_id, "👍");
  } else {
    await sendBonusForReview(admin, request, user.name);
    await setTelegramReaction(msg.chat.id, msg.message_id, "👀");
  }
  return true;
}
