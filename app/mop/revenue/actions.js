"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { sendTelegramMessage } from "@/lib/telegramBot";
import { escapeHtml } from "@/lib/notifyUser";
import { calculateRevenueCoins } from "@/lib/coinRate";
import { paymentDateToIso, formatPaymentDay, almatyDayKey } from "@/lib/timezone";
import {
  validateClientName,
  clientKey,
  PRODUCT_LABELS,
  PAY_LABELS,
  revenueKindText,
} from "@/lib/revenueKinds";

// Подсказки для формы: прошлые клиенты этого сотрудника. Тёзок не склеиваем:
// каждая незакрытая «часть» показывается отдельной строкой, выбирает человек.
export async function getClientHints() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { open: [], names: [] };

  const { data: rows } = await supabase
    .from("revenue_requests")
    .select("client_name, amount_kzt, pay_kind, is_final_part, earned_at, created_at, status")
    .eq("user_id", user.id)
    .not("client_name", "is", null)
    .neq("status", "rejected")
    .order("created_at", { ascending: false })
    .limit(400);

  const list = rows ?? [];
  const closed = new Set(list.filter((r) => r.is_final_part).map((r) => clientKey(r.client_name)));
  const names = [];
  const seenNames = new Set();
  const open = [];
  for (const r of list) {
    const key = clientKey(r.client_name);
    if (!seenNames.has(key)) {
      seenNames.add(key);
      names.push(r.client_name);
    }
    if (r.pay_kind === "part" && !r.is_final_part && !closed.has(key)) {
      open.push({
        name: r.client_name,
        amount: r.amount_kzt,
        date: r.earned_at || r.created_at,
      });
    }
  }
  return {
    names: names.slice(0, 200),
    open: open.slice(0, 60).map((o) => ({ ...o, dateLabel: formatPaymentDay(o.date).split(",")[0] })),
  };
}

export async function submitRevenueRequest(
  rawAmountKzt,
  comment,
  receiptConfirmed,
  paymentDay,
  extra = {}
) {
  // Колонка amount_kzt целая — сумма с копейками роняла вставку.
  const amountKzt = Math.round(Number(rawAmountKzt));
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  if (!amountKzt || amountKzt <= 0) {
    return { error: "Некорректная сумма" };
  }

  if (!receiptConfirmed) {
    return { error: "Подтверди, что отправил чек в группу" };
  }

  const clientCheck = validateClientName(extra?.clientName);
  if (clientCheck.error) return { error: clientCheck.error };
  const clientName = clientCheck.name;
  const productKind = extra?.productKind;
  const payKind = extra?.payKind;
  if (!PRODUCT_LABELS[productKind]) return { error: "Выбери продукт: курс или интенсив / МК" };
  if (!PAY_LABELS[payKind]) return { error: "Выбери вид оплаты: целиком или часть" };
  // «Целиком» всегда закрывает клиента; у «части» галочку ставит сам человек.
  const isFinalPart = payKind === "full" ? true : extra?.isFinalPart === true;

  // Дату оплаты МОП выбирает сам (забыл отправить вчера — ставит вчера).
  // Не выбрал — сегодня. Дальше 14 дней назад и в будущее нельзя.
  const earnedAt = paymentDateToIso(paymentDay);
  if (!earnedAt) {
    return { error: "Дату оплаты можно выбрать только за последние 14 дней" };
  }
  const isBackdated = almatyDayKey(earnedAt) !== almatyDayKey(new Date());

  const { data: profile } = await supabase
    .from("users")
    .select("name, coin_rate_multiplier, is_guest")
    .eq("id", user.id)
    .single();

  // Гость — общий демо-аккаунт: его заявки ушли бы в настоящую очередь
  // одобрения и в рабочую группу.
  if (profile?.is_guest) {
    return { error: "В гостевом режиме заявки на выручку не отправляются" };
  }

  // Это только оценка для отображения — итоговая сумма коинов
  // пересчитывается заново в момент одобрения (на случай если
  // множитель поменяется, пока заявка висит на рассмотрении).
  const coins = calculateRevenueCoins(amountKzt, profile?.coin_rate_multiplier);

  // Мягкая защита от дубля: такое же ФИО и сумма за последние 3 дня.
  // Не запрет: человек может подтвердить, и заявка уйдёт.
  if (!extra?.confirmDuplicate) {
    const since = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data: recent } = await supabase
      .from("revenue_requests")
      .select("client_name")
      .eq("user_id", user.id)
      .eq("amount_kzt", amountKzt)
      .neq("status", "rejected")
      .not("client_name", "is", null)
      .gte("created_at", since);
    if ((recent ?? []).some((r) => clientKey(r.client_name) === clientKey(clientName))) {
      return { duplicate: true };
    }
  }

  const { data: inserted, error } = await supabase
    .from("revenue_requests")
    .insert({
      user_id: user.id,
      amount_kzt: amountKzt,
      calculated_coins: coins,
      comment,
      client_name: clientName,
      product_kind: productKind,
      pay_kind: payKind,
      is_final_part: isFinalPart,
      receipt_confirmed: true,
      status: "pending",
      earned_at: earnedAt,
    })
    .select()
    .single();

  if (error) return { error: "Не удалось отправить заявку" };

  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;

  if (groupChatId) {
    const text =
      `💰 <b>Новая заявка на выручку</b>\n\n` +
      `От: <b>${escapeHtml(profile?.name ?? "МОП")}</b>\n` +
      `Клиент: <b>${escapeHtml(clientName)}</b>\n` +
      `Сумма: ${amountKzt.toLocaleString("ru-RU")} ₸\n` +
      `${escapeHtml(revenueKindText({ product_kind: productKind, pay_kind: payKind, is_final_part: isFinalPart }))}\n` +
      `Коинов: ${coins}\n` +
      `Дата оплаты: ${formatPaymentDay(earnedAt)}` +
      (isBackdated ? " ⚠️ задним числом" : "") +
      `\n` +
      (comment ? `Комментарий: ${escapeHtml(comment)}\n` : "");

    const threadId = process.env.TELEGRAM_REQUESTS_THREAD_ID
      ? Number(process.env.TELEGRAM_REQUESTS_THREAD_ID)
      : undefined;

    const tgResult = await sendTelegramMessage(
      groupChatId,
      text,
      {
        inline_keyboard: [
          [
            { text: "✅ Подтвердить", callback_data: `approve_rev:${inserted.id}` },
            { text: "❌ Отклонить", callback_data: `reject_rev:${inserted.id}` },
          ],
        ],
      },
      threadId
    );

    console.log("TELEGRAM_SEND_RESULT", JSON.stringify(tgResult));

    // Message id нужен, чтобы потом узнать реплай админа на это
    // сообщение и подтянуть его текст как комментарий к одобрению.
    if (tgResult?.result?.message_id) {
      const admin = createAdminClient();
      await admin
        .from("revenue_requests")
        .update({
          admin_chat_id: groupChatId,
          admin_message_id: tgResult.result.message_id,
        })
        .eq("id", inserted.id);
    }
  } else {
    console.log("TELEGRAM_GROUP_CHAT_ID is not set");
  }

  revalidatePath("/mop");
  return { success: true };
}
