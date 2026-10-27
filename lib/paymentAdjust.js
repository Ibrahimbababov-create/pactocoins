import { tieredRevenueCoins } from "@/lib/coinRate";
import { monthRevenueBefore } from "@/lib/revenueMonth";
import { recalcMentorBonus } from "@/lib/mentorBonus";
import { addCoins } from "@/lib/addCoins";
import { logRevenueChange } from "@/lib/revenueAudit";

function money(n) {
  return Number(n).toLocaleString("ru-RU");
}

// Правка подтверждённой оплаты: сумма и/или дата, коины пересчитываются по
// шкале месяца и множителю, разница доначисляется или списывается через
// addCoins, запись в журнал оплат. Общая часть для админской правки
// (adjustPayment) и для исправлений, которые предлагает сам сотрудник.
//
// request: свежая строка revenue_requests (status = approved).
// earnedAt: "YYYY-MM-DD" по Алматы или пусто (дата не меняется).
// extraPatch: поля, которые не влияют на коины (ФИО, продукт, вид оплаты),
//              пишутся тем же обновлением и попадают в тот же журнал.
// markRefund: уменьшение суммы помечается в комментарии оплаты как
//              «возврат». Для исправления опечатки это неправда, там false.
//
// Уведомление сотруднику и revalidatePath остаются на вызывающем.
export async function applyPaymentAdjustment(
  admin,
  { request, actorId, amountKzt, earnedAt, reason, extraPatch = {}, markRefund = true }
) {
  if (!request || request.status !== "approved") {
    return { error: "Оплата не найдена или уже отменена" };
  }

  const newAmount = Math.round(Number(amountKzt));
  if (!newAmount || newAmount <= 0) return { error: "Сумма должна быть больше нуля" };

  const { data: profile } = await admin
    .from("users")
    .select("coin_rate_multiplier")
    .eq("id", request.user_id)
    .single();

  // Новая дата может перенести оплату в другой месяц — шкалу считаем по ней.
  let newEarnedAt = request.earned_at ?? request.created_at;
  let earnedChanged = false;
  if (earnedAt) {
    const parsed = new Date(`${earnedAt}T12:00:00+05:00`);
    if (!isNaN(parsed)) {
      newEarnedAt = parsed.toISOString();
      earnedChanged = true;
    }
  }
  const monthBefore = await monthRevenueBefore(admin, request.user_id, newEarnedAt, request.id);
  const newCoins = tieredRevenueCoins(newAmount, profile?.coin_rate_multiplier, monthBefore);
  const oldCoins = request.credited_coins ?? request.calculated_coins ?? 0;
  const diff = newCoins - oldCoins;

  const patch = {
    ...extraPatch,
    amount_kzt: newAmount,
    calculated_coins: newCoins,
    credited_coins: newCoins,
  };

  // Помечаем правку прямо в заявке: через месяц никто не вспомнит,
  // почему у оплаты «неправильная» сумма. Рейтинг считается по сумме
  // заявки, так что уменьшили её — ушло и из рейтинга.
  if (markRefund && newAmount < request.amount_kzt) {
    const note = `возврат ${money(request.amount_kzt - newAmount)} ₸ из ${money(
      request.amount_kzt
    )} ₸`;
    patch.comment = [request.comment?.trim(), note].filter(Boolean).join("\n");
  }
  if (earnedChanged) patch.earned_at = newEarnedAt;

  // Обновляем, только если оплата всё ещё подтверждена: пока админ думал,
  // её могли отменить, и тогда коины двигать нельзя.
  const { data: updated, error: updateError } = await admin
    .from("revenue_requests")
    .update(patch)
    .eq("id", request.id)
    .eq("status", "approved")
    .select("id");
  if (updateError) return { error: "Не удалось сохранить оплату" };
  if (!updated?.length) return { error: "Оплата не найдена или уже отменена" };

  if (diff !== 0) {
    const { error: coinsError } = await addCoins(admin, request.user_id, diff);
    if (coinsError) {
      // Коины не сдвинулись: возвращаем оплату как было, чтобы сумма и
      // начисление не разошлись.
      const back = {};
      for (const key of Object.keys(patch)) back[key] = request[key] ?? null;
      await admin.from("revenue_requests").update(back).eq("id", request.id);
      return { error: coinsError.message || "Не удалось пересчитать коины" };
    }
  }

  const auditBefore = { amount_kzt: request.amount_kzt, credited_coins: oldCoins };
  const auditAfter = { amount_kzt: newAmount, credited_coins: newCoins };
  if (patch.earned_at) {
    auditBefore.earned_at = request.earned_at;
    auditAfter.earned_at = patch.earned_at;
  }
  for (const key of Object.keys(extraPatch)) {
    auditBefore[key] = request[key] ?? null;
    auditAfter[key] = extraPatch[key];
  }
  await logRevenueChange(admin, {
    requestId: request.id,
    userId: request.user_id,
    actorId,
    source: "web",
    action: "edit",
    before: auditBefore,
    after: auditAfter,
    note: reason,
  });

  // Сумма изменилась — процент наставника пересчитываем от новой.
  await recalcMentorBonus(admin, { ...request, ...patch, status: "approved" });

  if (diff !== 0) {
    // «Всего заработано» поднимается триггером на каждом начислении, но на
    // списании не опускается. Уменьшили оплату — уменьшаем и её, иначе в
    // профиле навсегда останутся коины за сумму, которой не было.
    if (diff < 0) {
      const { data: earned } = await admin
        .from("users")
        .select("total_earned")
        .eq("id", request.user_id)
        .single();
      if (earned) {
        await admin
          .from("users")
          .update({ total_earned: Math.max(0, (earned.total_earned ?? 0) + diff) })
          .eq("id", request.user_id);
      }
    }

    await admin.from("transactions").insert({
      user_id: request.user_id,
      type: diff > 0 ? "manual_add" : "manual_subtract",
      amount_coins: diff,
      description: `Правка оплаты: ${money(request.amount_kzt)} ₸ → ${money(newAmount)} ₸`,
      created_by: actorId,
      source: "manual",
      rating_exempt: true,
    });
  }

  return { success: true, oldCoins, newCoins, diff, newAmount, patch };
}
