"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { chestEligible } from "@/lib/chest";
import { addChips } from "@/lib/addChips";
import { validateAnswers, SURVEY_REWARD_CHIPS } from "@/lib/surveyQuestions";
import { getSurveyConfig, claimDone, releaseDone, saveResponse } from "@/lib/survey";

// Отправка опроса. Порядок важен:
//  1. «захватываем» отметку «прошёл» (второй раз она не запишется),
//  2. сохраняем ответы без имени,
//  3. только потом начисляем фишки.
// Если ответы не сохранились, отметку снимаем, и человек пройдёт заново.
export async function submitSurvey(rawAnswers) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("users")
    .select("id, role, is_active, is_guest, email")
    .eq("id", user.id)
    .single();
  if (!me) return { error: "Не авторизован" };

  // Админ и гость смотрят, как это выглядит: ничего не сохраняем и ничего
  // не начисляем, чтобы пробы не портили результаты.
  if (me.role === "admin" || me.is_guest) return { ok: true, preview: true };

  if (!chestEligible(me)) return { error: "Опрос для сотрудников команды" };
  if (!(await getSurveyConfig(admin)).open) return { error: "Опрос сейчас закрыт" };

  const checked = validateAnswers(rawAnswers);
  if (checked.error) return { error: checked.error };

  const claim = await claimDone(admin, me.id);
  if (claim.exists) return { error: "Ты уже прошёл этот опрос, спасибо" };
  if (claim.error) {
    console.error("[survey] claim failed", claim.error);
    return { error: "Не получилось отправить, попробуй ещё раз" };
  }

  const saved = await saveResponse(admin, checked.clean);
  if (saved.error) {
    console.error("[survey] save failed", saved.error);
    await releaseDone(admin, me.id);
    return { error: "Не получилось сохранить ответы, попробуй ещё раз" };
  }

  const chips = await addChips(admin, me.id, SURVEY_REWARD_CHIPS, "Опрос команды");
  if (!chips.ok) {
    // Ответы уже сохранены, повторно проходить не нужно: админ добавит руками.
    console.error("[survey] chips failed for", me.id);
    return { ok: true, rewarded: false };
  }
  return { ok: true, rewarded: true, chips: SURVEY_REWARD_CHIPS };
}
