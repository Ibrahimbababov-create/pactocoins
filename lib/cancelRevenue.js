import { addCoins } from "@/lib/addCoins";
import { notifyUser, escapeHtml } from "@/lib/notifyUser";
import { revokeMentorBonus } from "@/lib/mentorBonus";
import { formatCoins } from "@/lib/plural";
import { logRevenueChange } from "@/lib/revenueAudit";

// Отмена уже одобренной оплаты. Одна и та же для кнопки в админке и для
// команды в телеграме, чтобы «отменил там» и «отменил тут» значили ровно
// одно и то же.
//
// Возвращает { request, coins } либо { error } — текстом, готовым к показу.
export async function cancelApprovedRevenue(admin, requestId, { byUserId, comment, source = "web", actorName } = {}) {
  const { data: request } = await admin
    .from("revenue_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request) return { error: "Заявка не найдена" };
  if (request.status === "rejected") return { error: "Эта оплата уже отменена" };
  if (request.status !== "approved") {
    return { error: "Эта заявка ещё не подтверждена, её можно просто отклонить кнопкой" };
  }

  const coins = request.credited_coins ?? 0;

  // Сначала статус, и только если он всё ещё «одобрено» — иначе две отмены
  // подряд списали бы коины дважды.
  const { data: claimed } = await admin
    .from("revenue_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: byUserId ?? null,
    })
    .eq("id", requestId)
    .eq("status", "approved")
    .select("id");

  if (!claimed?.length) return { error: "Эта оплата уже отменена" };

  await logRevenueChange(admin, {
    requestId,
    userId: request.user_id,
    actorId: byUserId,
    actorName,
    source,
    action: "cancel",
    before: { status: "approved", amount_kzt: request.amount_kzt, credited_coins: coins, earned_at: request.earned_at, client_name: request.client_name },
    after: { status: "rejected" },
    note: comment,
  });

  // Вместе с оплатой уходит и процент, начисленный наставнику.
  await revokeMentorBonus(admin, requestId);

  if (coins) {
    await addCoins(admin, request.user_id, -coins);

    // «Всего заработано» живёт отдельным полем: триггер поднимает его при
    // начислении, но на списании не трогает. Без этой строки отменённая
    // оплата навсегда оставалась бы в «заработано за всё время».
    const { data: profile } = await admin
      .from("users")
      .select("total_earned")
      .eq("id", request.user_id)
      .single();
    if (profile) {
      await admin
        .from("users")
        .update({ total_earned: Math.max(0, (profile.total_earned ?? 0) - coins) })
        .eq("id", request.user_id);
    }

    await admin.from("transactions").insert({
      user_id: request.user_id,
      type: "manual_subtract",
      amount_coins: -coins,
      description: `Отменено (одобрено по ошибке): выручка ${request.amount_kzt.toLocaleString(
        "ru-RU"
      )} ₸`,
      created_by: byUserId ?? null,
    });
  }

  let text = `⚠️ Заявка на выручку ${request.amount_kzt.toLocaleString(
    "ru-RU"
  )} ₸ отменена (одобрена по ошибке)${coins ? ` — ${formatCoins(coins)} списаны обратно` : ""}`;
  if (comment?.trim()) text += `\n\n💬 ${escapeHtml(comment.trim())}`;
  await notifyUser(admin, request.user_id, text, "notify_requests");

  return { request, coins };
}
