import { readConfigJson, writeConfigJson } from "@/lib/configStore";
import { addCoins } from "@/lib/addCoins";
import { notifyUser } from "@/lib/notifyUser";
import { formatCoins } from "@/lib/plural";
import { nowInAlmaty } from "@/lib/timezone";

// «Копилка» наставника. Процент с оплат стажёров не падает на баланс сразу,
// а копится записями в mentor_bonuses. Раз в месяц 5-го числа (Алматы) всё
// накопленное высыпается на баланс одним начислением.
//
// Схему базы не меняем: «высыпано или нет» определяем по дате. Запись
// высыпана, если создана раньше отметки releasedUpTo. Отметка лежит в
// закрытом конфиг-файле и двигается только после успешной раздачи.
// Записи старше PIGGY_START наставники уже получили сразу, по старой схеме.
export const PIGGY_START = "2026-10-29T15:18:00+05:00";
export const RELEASE_DAY = 5;
// Коин ≈ 2 ₸: так считаем деньги в статистике наставничества.
export const MENTOR_KZT_PER_COIN = 2;

const FILE = "mentor-piggy.json";

const pad = (n) => String(n).padStart(2, "0");

// Ближайшее 5-е число 00:00 по Алматы, которое уже наступило.
export function latestReleaseCutoff(now = nowInAlmaty()) {
  let { year, month } = now;
  if (now.day < RELEASE_DAY) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return `${year}-${pad(month)}-${pad(RELEASE_DAY)}T00:00:00+05:00`;
}

// Следующее 5-е число: "ДД.ММ" для экрана наставника.
export function nextReleaseLabel(now = nowInAlmaty()) {
  let { year, month } = now;
  if (now.day >= RELEASE_DAY) {
    month += 1;
    if (month === 13) month = 1;
  }
  return `${pad(RELEASE_DAY)}.${pad(month)}`;
}

// До какого момента копилка уже высыпана (ISO-строка).
export async function getReleasedUpTo(admin) {
  const saved = await readConfigJson(admin, FILE, null);
  const t = saved?.releasedUpTo ? new Date(saved.releasedUpTo).getTime() : 0;
  return new Date(Math.max(t, new Date(PIGGY_START).getTime())).toISOString();
}

export function isReleased(createdAt, releasedUpTo) {
  return new Date(createdAt).getTime() < new Date(releasedUpTo).getTime();
}

// Раздаёт накопленное. Безопасно запускать сколько угодно раз: пока не
// наступило новое 5-е число, ничего не делает, а на каждого наставника
// есть отметка-транзакция «копилка за <дата>», второй раз она не пишется.
export async function releaseMentorPiggies(admin) {
  const cutoff = latestReleaseCutoff();
  const upTo = await getReleasedUpTo(admin);
  if (new Date(cutoff) <= new Date(upTo)) return { released: false, mentors: 0, coins: 0 };

  const { data: rows, error } = await admin
    .from("mentor_bonuses")
    .select("mentor_id, coins")
    .gte("created_at", upTo)
    .lt("created_at", cutoff)
    .limit(5000);
  if (error) throw error;

  const byMentor = new Map();
  for (const r of rows ?? []) {
    byMentor.set(r.mentor_id, (byMentor.get(r.mentor_id) ?? 0) + (Number(r.coins) || 0));
  }

  const dateKey = cutoff.slice(0, 10);
  const marker = `Наставничество: копилка за ${dateKey}`;
  let mentors = 0;
  let coinsTotal = 0;
  let failed = false;

  for (const [mentorId, coins] of byMentor) {
    if (coins <= 0) continue;
    try {
      const { data: done } = await admin
        .from("transactions")
        .select("id")
        .eq("user_id", mentorId)
        .eq("description", marker)
        .limit(1);
      if (done?.length) continue;

      // Сначала отметка, потом коины: при сбое лучше недодать и повторить,
      // чем начислить дважды.
      const { data: tx, error: txErr } = await admin
        .from("transactions")
        .insert({
          user_id: mentorId,
          type: "manual_add",
          amount_coins: coins,
          description: marker,
          source: "bonus",
          rating_exempt: true,
        })
        .select("id")
        .single();
      if (txErr) throw txErr;

      const { error: addErr } = await addCoins(admin, mentorId, coins);
      if (addErr) {
        await admin.from("transactions").delete().eq("id", tx.id);
        throw new Error(addErr.message);
      }

      mentors += 1;
      coinsTotal += coins;
      await notifyUser(
        admin,
        mentorId,
        `🎁 <b>Копилка наставника открылась: +${formatCoins(coins)}</b>\n\nПроцент с оплат твоих стажёров за прошлый период зачислен на баланс.`,
        "notify_requests"
      );
    } catch (err) {
      failed = true;
      console.error("[mentorPiggy] не высыпалось для", mentorId, err?.message);
    }
  }

  // Двигаем отметку только если никого не пропустили: повторный запуск
  // доберёт остальных, а тех, кому уже начислено, пропустит по отметке.
  if (!failed) {
    const w = await writeConfigJson(admin, FILE, {
      releasedUpTo: cutoff,
      updatedAt: new Date().toISOString(),
    });
    if (w?.error) console.error("[mentorPiggy] отметку не записали:", w.error);
  }

  return { released: !failed, mentors, coins: coinsTotal };
}
