import { thisWeekRangeAlmaty, lastWeekRangeAlmaty } from "@/lib/timezone";
import { WEEKLY_TOP } from "@/lib/topBonusConfig";
import { notifyUser, escapeHtml } from "@/lib/notifyUser";

// Уведомления «Рейтинг» из настроек (notify_rating): тебя обошли, ты
// поднялся, итоги недели. Считаем тем же rating_revenue и по тем же людям,
// что экран рейтинга. Формулировки без рода — имена бывают любые.

const kzt = (n) => `${Math.round(n).toLocaleString("ru-RU")} ₸`;
// Сообщать «тебя обошли» только тем, кто борется за верх таблицы, иначе
// каждая оплата будит полкоманды.
const WATCH_TOP = 5;

async function weekTotals(admin, range) {
  const [{ data: users }, { data: rows }] = await Promise.all([
    admin
      .from("users")
      .select("id, name, is_active")
      .in("role", ["mop", "observer"])
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local"),
    admin.rpc("rating_revenue", { p_start: range.start, p_end: range.end }),
  ]);
  const byId = Object.fromEntries((users ?? []).map((u) => [u.id, u]));
  return (rows ?? [])
    .filter((r) => byId[r.user_id] && Number(r.total) > 0)
    .map((r) => ({
      id: r.user_id,
      name: byId[r.user_id].name,
      active: byId[r.user_id].is_active !== false,
      value: Number(r.total),
    }))
    .sort((a, b) => b.value - a.value);
}

const placeAmong = (values, v) => values.filter((x) => x > v).length + 1;

// Вызывается сразу после одобрения выручки (в админке и кнопкой в Telegram).
// Ничего не бросает: уведомление не должно ронять одобрение.
export async function notifyRatingShift(admin, { userId, amountKzt, earnedAtIso }) {
  try {
    const week = thisWeekRangeAlmaty();
    const t = new Date(earnedAtIso).getTime();
    if (!(t >= Date.parse(week.start) && t < Date.parse(week.end))) return;

    const totals = await weekTotals(admin, week);
    const me = totals.find((r) => r.id === userId);
    if (!me) return;

    const after = me.value;
    const before = after - Number(amountKzt || 0);
    const others = totals.filter((r) => r.id !== userId);
    const otherValues = others.map((r) => r.value);

    const placeAfter = placeAmong(otherValues, after);
    const placeBefore = before > 0 ? placeAmong(otherValues, before) : null;

    // Кого обошли: были выше или вровень, теперь ниже.
    const passed = others.filter((r) => r.value >= before && r.value < after);

    if (placeBefore == null || placeAfter < placeBefore) {
      const ahead = others.filter((r) => r.value > after).at(-1);
      let text = `📈 Рейтинг недели: теперь у тебя <b>${placeAfter} место</b>`;
      if (placeBefore != null) text += ` (было ${placeBefore})`;
      text += `\nЗа неделю: ${kzt(after)}`;
      if (passed.length && placeBefore != null) {
        text += `\nПозади остались: ${passed.map((r) => escapeHtml(r.name)).join(", ")}`;
      }
      text += ahead
        ? `\n\nДо ${placeAfter - 1}-го места — ${kzt(ahead.value - after)}`
        : "\n\nТы лидер недели 🔥";
      await notifyUser(admin, userId, text, "notify_rating");
    }

    // Тем, кого обошли, — только если они были в верхней части таблицы.
    const allBefore = totals.map((r) => (r.id === userId ? before : r.value));
    await Promise.allSettled(
      passed
        .filter((r) => r.active)
        .map((r) => {
          const oldPlace = placeAmong(allBefore.filter((_, i) => totals[i].id !== r.id), r.value);
          if (oldPlace > WATCH_TOP) return null;
          const newPlace = placeAmong(
            totals.filter((x) => x.id !== r.id).map((x) => x.value),
            r.value
          );
          return notifyUser(
            admin,
            r.id,
            `⚡ ${escapeHtml(me.name)} — выше тебя в рейтинге недели.\n` +
              `Теперь у тебя <b>${newPlace} место</b> (было ${oldPlace}).\n\n` +
              `Отставание — ${kzt(after - r.value)}. Ещё можно отыграться!`,
            "notify_rating"
          );
        })
    );
  } catch (err) {
    console.error("[ratingNotify] shift failed:", err);
  }
}

// Итоги прошлой недели — каждому, у кого были оплаты. Крон в понедельник.
export async function sendWeeklyRatingSummary(admin) {
  const range = lastWeekRangeAlmaty();
  const totals = await weekTotals(admin, range);
  const values = totals.map((r) => r.value);
  let sent = 0;

  await Promise.allSettled(
    totals
      .filter((r) => r.active)
      .map(async (r) => {
        const place = placeAmong(values, r.value);
        let text =
          `🏁 Итоги недели ${range.label}\n\n` +
          `Твоё место: <b>${place} из ${totals.length}</b>\n` +
          `Выручка: ${kzt(r.value)}`;
        if (place <= WEEKLY_TOP.prizes.length && r.value >= WEEKLY_TOP.min) {
          text += `\n\n🏆 Ты в призовой тройке недели и взял порог!`;
        } else if (r.value < WEEKLY_TOP.min) {
          text += `\n\nДо порога приза (${WEEKLY_TOP.minLabel}) не хватило ${kzt(WEEKLY_TOP.min - r.value)}.`;
        }
        text += "\n\nНовая неделя уже началась — удачи!";
        await notifyUser(admin, r.id, text, "notify_rating", { silent: true });
        sent++;
      })
  );
  return sent;
}
