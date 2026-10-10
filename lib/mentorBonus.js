import { formatCoins } from "@/lib/plural";
import { notifyUser, escapeHtml } from "@/lib/notifyUser";
import { addCoins } from "@/lib/addCoins";

// Наставник получает процент с оплат тех, кого он вёл: 1% от суммы за
// вычетом 20%, пересчитанный в коины по магазинному курсу (коин ≈ 2 ₸).
// С миллиона выходит 4000 коинов — так договорились.
//
// Окно: ровно 30 дней с первой оплаты подопечного. Сама первая оплата
// в окно входит.
const MENTOR_SHARE = 0.004; // 0.8 (чистыми) × 0.01 (процент) / 2 (курс)
const WINDOW_DAYS = 30;

export function mentorBonusCoins(amountKzt) {
  return Math.floor((Number(amountKzt) || 0) * MENTOR_SHARE);
}

function payDate(request) {
  return new Date(request?.earned_at ?? request?.created_at ?? Date.now());
}

// Дата первой подтверждённой оплаты сотрудника. Вызывать уже после того,
// как текущая заявка помечена одобренной, иначе первая оплата сама себя
// не увидит.
async function firstPaymentAt(admin, userId) {
  const { data } = await admin
    .from("revenue_requests")
    .select("earned_at, created_at")
    .eq("user_id", userId)
    .eq("status", "approved")
    .order("earned_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return data ? payDate(data) : null;
}

// Начисляет наставнику процент с оплаты. Молча выходит, если наставника
// нет, окно закрыто или за эту заявку уже начисляли.
export async function creditMentorBonus(admin, request) {
  try {
    const { data: trainee } = await admin
      .from("users")
      .select("id, name, mentor_id")
      .eq("id", request.user_id)
      .single();

    if (!trainee?.mentor_id) return;

    const { data: already } = await admin
      .from("mentor_bonuses")
      .select("id")
      .eq("request_id", request.id)
      .maybeSingle();
    if (already) return;

    const firstAt = await firstPaymentAt(admin, request.user_id);
    if (!firstAt) return;

    const days = (payDate(request) - firstAt) / 86400000;
    if (days < 0 || days > WINDOW_DAYS) return;

    const coins = mentorBonusCoins(request.amount_kzt);
    if (coins <= 0) return;

    const { data: mentor } = await admin
      .from("users")
      .select("id, balance")
      .eq("id", trainee.mentor_id)
      .single();
    if (!mentor) return;

    await addCoins(admin, mentor.id, coins);

    await admin.from("transactions").insert({
      user_id: mentor.id,
      type: "manual_add",
      amount_coins: coins,
      description: `Наставничество 1%: ${trainee.name}, ${Number(
        request.amount_kzt
      ).toLocaleString("ru-RU")} ₸`,
      source: "bonus",
      rating_exempt: true,
    });

    await admin.from("mentor_bonuses").insert({
      request_id: request.id,
      mentor_id: mentor.id,
      trainee_id: trainee.id,
      coins,
    });

    await notifyUser(
      admin,
      mentor.id,
      `🎓 <b>+${formatCoins(coins)} за наставничество</b>\n\n${escapeHtml(
        trainee.name
      )} провёл оплату ${Number(request.amount_kzt).toLocaleString(
        "ru-RU"
      )} ₸ — это твой процент как наставника.`,
      "notify_requests"
    );
  } catch (err) {
    // Начисление наставнику не должно ронять одобрение самой оплаты.
    console.error("[mentorBonus] начислить не удалось:", err?.message);
  }
}

// Снимает ранее начисленное — когда оплату отменили. Возвращает число
// списанных коинов.
export async function revokeMentorBonus(admin, requestId, reason = "отменена") {
  try {
    const { data: bonus } = await admin
      .from("mentor_bonuses")
      .select("id, mentor_id, trainee_id, coins")
      .eq("request_id", requestId)
      .maybeSingle();
    if (!bonus) return 0;

    await addCoins(admin, bonus.mentor_id, -bonus.coins);

    await admin.from("transactions").insert({
      user_id: bonus.mentor_id,
      type: "manual_subtract",
      amount_coins: -bonus.coins,
      description: `Наставничество: оплата ${reason}`,
      source: "manual",
      rating_exempt: true,
    });

    await admin.from("mentor_bonuses").delete().eq("id", bonus.id);
    return bonus.coins;
  } catch (err) {
    console.error("[mentorBonus] откатить не удалось:", err?.message);
    return 0;
  }
}

// Оплату не отменили, а поправили сумму — пересчитываем разницу.
export async function recalcMentorBonus(admin, request) {
  await revokeMentorBonus(admin, request.id, "исправлена");
  await creditMentorBonus(admin, request);
}
