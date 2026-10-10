"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { nowInAlmaty } from "@/lib/timezone";
import { getLevelForAmount } from "@/lib/levels";
import { fetchTelegraphContent } from "@/lib/telegraph";
import { maybeGraduateTrainee } from "@/lib/onboarding";

export async function updateMyName(formData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const name = (formData.get("name")?.toString() || "").trim();
  if (!name) return { error: "Укажи имя" };
  if (name.length > 50) return { error: "Слишком длинное имя" };

  const admin = createAdminClient();

  // Гость один на всех: переименуй его один посетитель — увидят остальные
  // и админ в уведомлениях о покупках.
  const { data: me } = await admin
    .from("users")
    .select("is_guest")
    .eq("id", user.id)
    .single();
  if (me?.is_guest) return { error: "В гостевом режиме имя не меняется" };
  const { error } = await admin
    .from("users")
    .update({ name })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/mop");
  return { success: true };
}

const NOTIFY_PREFS = new Set([
  "notify_requests",
  "notify_shop",
  "notify_goal",
  "notify_rating",
]);

export async function updateNotificationPref(key, enabled) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };
  if (!NOTIFY_PREFS.has(key)) return { error: "Неизвестная настройка" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ [key]: !!enabled })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/mop/settings");
  return { success: true };
}

export async function updateReminderSettings(formData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const enabled = formData.get("enabled") === "on";
  const time = formData.get("time")?.toString() || null;

  if (enabled && !time) return { error: "Укажи время" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({
      reminder_enabled: enabled,
      reminder_time: enabled ? time : null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/mop/settings");
  return { success: true };
}

// Пользователь досмотрел полноэкранную анимацию нового ранга —
// запоминаем, чтобы не показывать её снова. Ранг считаем заново из
// total_earned, значение с клиента не принимаем.
export async function markLevelCelebrated() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const { data: profile } = await supabase
    .from("users")
    .select("total_earned")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Профиль не найден" };

  const level = getLevelForAmount(profile.total_earned);

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ celebrated_level_id: level.id })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/mop");
  return { success: true };
}

export async function setMyBirthday(formData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const { data: profile } = await supabase
    .from("users")
    .select("birthday")
    .eq("id", user.id)
    .single();

  if (profile?.birthday) {
    return { error: "Дата рождения уже указана" };
  }

  const birthday = formData.get("birthday");
  if (!birthday) return { error: "Укажи дату" };

  const alreadyGifted = formData.get("already_gifted") === "on";

  const admin = createAdminClient();
  const update = { birthday };
  if (alreadyGifted) {
    update.last_birthday_bonus_year = nowInAlmaty().year;
  }

  const { error } = await admin
    .from("users")
    .update(update)
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/mop");
  return { success: true };
}

// ---------- Иерархия МОП ↔ РОП ----------

async function me() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");
  const { data: profile } = await supabase
    .from("users")
    .select("id, role, project_id")
    .eq("id", user.id)
    .single();
  return profile;
}

// МОП выбирает / меняет своего руководителя.
export async function setMyRop(ropId) {
  const p = await me();
  const admin = createAdminClient();

  let clean = null;
  if (ropId) {
    const { data: rop } = await admin
      .from("users")
      .select("id")
      .eq("id", ropId)
      .eq("role", "rop")
      .eq("is_active", true)
      .maybeSingle();
    if (!rop) return { error: "РОП не найден" };
    clean = rop.id;
  }

  const { error } = await admin
    .from("users")
    .update({ rop_id: clean })
    .eq("id", p.id);
  if (error) return { error: error.message };

  revalidatePath("/mop/settings");
  revalidatePath("/mop/team");
  return { success: true };
}

// РОП забирает МОПа себе в команду.
export async function assignMopToMe(mopId) {
  const p = await me();
  if (p.role !== "rop" && p.role !== "admin") return { error: "Нет прав" };
  const admin = createAdminClient();

  const { data: mop } = await admin
    .from("users")
    .select("id, role, rop_id")
    .eq("id", mopId)
    .eq("is_active", true)
    .maybeSingle();
  if (!mop || (mop.role !== "mop" && mop.role !== "trainee")) {
    return { error: "Сотрудник не найден" };
  }

  // РОП может забрать только свободного МОПа. Переназначать чужого —
  // только через админа.
  if (p.role === "rop" && mop.rop_id && mop.rop_id !== p.id) {
    return { error: "Этот МОП уже в команде другого РОПа" };
  }

  const { error } = await admin
    .from("users")
    .update({ rop_id: p.id })
    .eq("id", mopId);
  if (error) return { error: error.message };

  revalidatePath("/mop/team");
  return { success: true };
}

// РОП убирает МОПа из своей команды (только своего).
export async function unassignMop(mopId) {
  const p = await me();
  if (p.role !== "rop" && p.role !== "admin") return { error: "Нет прав" };
  const admin = createAdminClient();

  let q = admin.from("users").update({ rop_id: null }).eq("id", mopId);
  if (p.role === "rop") q = q.eq("rop_id", p.id);

  const { error } = await q;
  if (error) return { error: error.message };

  revalidatePath("/mop/team");
  return { success: true };
}

// ---------- Обучение новичков (v2, блоки) ----------

// Стажёр отмечает блок как изученный. Админ тоже: он проходит обучение,
// когда смотрит кабинет глазами стажёра, иначе не проверить, работают ли
// кнопки и тесты. На рейтинг обучение не влияет — рейтинг считается по
// подтверждённой выручке.
export async function markOnboardingBlockDone(blockId) {
  const p = await me();
  if (p.role !== "trainee" && p.role !== "admin") {
    return { error: "Только для стажёров" };
  }
  const admin = createAdminClient();
  // Тест засчитывается только сдачей (submitOnboardingTest), иначе его
  // можно было «пройти» этим действием, не отвечая на вопросы.
  const { data: block } = await admin
    .from("onboarding_blocks")
    .select("kind")
    .eq("id", blockId)
    .maybeSingle();
  if (!block || block.kind === "test") return { error: "Этот блок так не отмечается" };

  const { error } = await admin
    .from("onboarding_progress")
    .upsert({ user_id: p.id, block_id: blockId }, { onConflict: "user_id,block_id" });
  if (error) return { error: error.message };
  revalidatePath("/mop");
  return { success: true };
}

// Стажёр сдаёт тест дня. answers — массив индексов ответов по порядку sort.
// Админу тоже разрешено: пусть проходит и проверяет вопросы сам.
export async function submitOnboardingTest(blockId, day, answers) {
  const p = await me();
  if (p.role !== "trainee" && p.role !== "admin") {
    return { error: "Только для стажёров" };
  }
  const admin = createAdminClient();

  const { data: test } = await admin
    .from("onboarding_tests")
    .select("id, pass_pct")
    .eq("day", day)
    .maybeSingle();
  if (!test) return { error: "Тест не найден" };

  const { data: qs } = await admin
    .from("onboarding_questions")
    .select("id, correct")
    .eq("test_id", test.id)
    .order("sort")
    .order("id");
  if (!qs?.length) return { error: "В тесте пока нет вопросов" };

  // Блок должен быть тестом этого же дня — иначе «сдачей» можно было
  // отметить пройденным любой блок.
  const { data: block } = await admin
    .from("onboarding_blocks")
    .select("kind, day")
    .eq("id", blockId)
    .maybeSingle();
  if (!block || block.kind !== "test" || Number(block.day) !== Number(day)) {
    return { error: "Тест не найден" };
  }

  // Новый клиент шлёт { [id вопроса]: ответ }, старый — массив по порядку.
  const byId = answers && !Array.isArray(answers) && typeof answers === "object";
  const wrong = [];
  let correct = 0;
  qs.forEach((q, i) => {
    const given = byId ? answers[q.id] : answers?.[i];
    if (given !== undefined && given !== null && Number(given) === q.correct) correct++;
    else wrong.push(i);
  });
  const score = Math.round((correct / qs.length) * 100);
  const passed = score >= test.pass_pct;

  await admin.from("onboarding_attempts").insert({
    user_id: p.id,
    test_id: test.id,
    score_pct: score,
    passed,
  });
  if (passed) {
    await admin
      .from("onboarding_progress")
      .upsert({ user_id: p.id, block_id: blockId }, { onConflict: "user_id,block_id" });
  }

  revalidatePath("/mop");
  return { success: true, score, passed, total: qs.length, correct, wrong };
}

async function requireRopOrAdmin() {
  const p = await me();
  if (p.role !== "rop" && p.role !== "admin") throw new Error("Нет прав");
  return p;
}

// Материалы теперь принадлежат проекту. Админ и наставник правят любой
// проект, РОП — только те, за которыми он закреплён.
async function requireProjectEditor(projectId) {
  const p = await me();
  if (!projectId) throw new Error("Не выбран проект");
  if (p.role === "admin" || p.role === "mentor") return p;
  if (p.role !== "rop") throw new Error("Нет прав");

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("project_rops")
    .select("project_id")
    .eq("rop_id", p.id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (link) return p;
  if (p.project_id === projectId) return p;
  throw new Error("Это не твой проект");
}

// РОП/админ вручную допускает стажёра после аттестации → МОП 1 уровня.
export async function graduateTrainee(traineeId) {
  const p = await requireRopOrAdmin();
  const admin = createAdminClient();

  const { data: t } = await admin
    .from("users")
    .select("id, role, rop_id")
    .eq("id", traineeId)
    .maybeSingle();
  if (!t || t.role !== "trainee") return { error: "Это не стажёр" };
  if (p.role === "rop" && t.rop_id !== p.id) {
    return { error: "Этот стажёр не в твоей команде" };
  }

  const res = await maybeGraduateTrainee(admin, traineeId, "manual");
  if (!res.graduated) return { error: "Не удалось допустить" };

  revalidatePath("/mop/team");
  revalidatePath("/admin/employees");
  return { success: true };
}

// Готовим payload для onboarding_rop_blocks / onboarding_blocks из формы.
async function buildBlockContent(source, telegraphUrl, bodyMd) {
  if (source === "telegraph") {
    const url = (telegraphUrl || "").trim();
    const fetched = await fetchTelegraphContent(url);
    if (!fetched.ok) return { error: fetched.error };
    return {
      fields: {
        source: "telegraph",
        telegraph_url: url,
        body_md: null,
        cached_content: fetched.content,
        cached_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };
  }
  const md = (bodyMd || "").trim();
  if (!md) return { error: "Добавь текст статьи или ссылку на telegra.ph" };
  return {
    fields: {
      source: "text",
      telegraph_url: null,
      body_md: md,
      cached_content: null,
      cached_at: null,
      updated_at: new Date().toISOString(),
    },
  };
}

// РОП заполняет свой блок (owner='rop'): текст или telegra.ph.
export async function setMyOnboardingBlock(blockId, projectId, { source, telegraph_url, body_md }) {
  await requireProjectEditor(projectId);
  const admin = createAdminClient();

  const { data: block } = await admin
    .from("onboarding_blocks")
    .select("id, owner, kind")
    .eq("id", blockId)
    .maybeSingle();
  if (!block || block.owner !== "rop" || block.kind !== "article") {
    return { error: "Этот блок нельзя редактировать здесь" };
  }

  const built = await buildBlockContent(source, telegraph_url, body_md);
  if (built.error) return { error: built.error };

  const { error } = await admin
    .from("onboarding_rop_blocks")
    .upsert(
      { block_id: blockId, project_id: projectId, ...built.fields },
      { onConflict: "block_id,project_id" }
    );
  if (error) return { error: error.message };
  revalidatePath("/mop/onboarding-materials");
  revalidatePath("/mop");
  return { success: true };
}

// РОП сбрасывает свой блок к общему дефолту.
export async function resetMyOnboardingBlock(blockId, projectId) {
  await requireProjectEditor(projectId);
  const admin = createAdminClient();
  const { error } = await admin
    .from("onboarding_rop_blocks")
    .delete()
    .eq("block_id", blockId)
    .eq("project_id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/mop/onboarding-materials");
  return { success: true };
}

export async function addMyOnboardingLink(blockId, projectId, { title, url, note }) {
  await requireProjectEditor(projectId);
  const admin = createAdminClient();
  const { data: block } = await admin
    .from("onboarding_blocks")
    .select("owner, kind")
    .eq("id", blockId)
    .maybeSingle();
  if (!block || block.owner !== "rop" || block.kind !== "links") {
    return { error: "Сюда нельзя добавлять ссылки" };
  }
  const clean = (url || "").trim();
  if (!title?.trim() || !clean) return { error: "Название и ссылка обязательны" };
  const href = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
  const { error } = await admin.from("onboarding_links").insert({
    block_id: blockId,
    project_id: projectId,
    title: title.trim(),
    url: href,
    note: note?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/mop/onboarding-materials");
  revalidatePath("/mop");
  return { success: true };
}

// Если ссылка вела на загруженный в наш bucket файл — удаляем и сам файл.
async function deleteOnboardingStorageFile(admin, url) {
  const marker = "/onboarding-files/";
  const i = (url || "").indexOf(marker);
  if (i === -1) return;
  const path = url.slice(i + marker.length).split("?")[0];
  if (path) await admin.storage.from("onboarding-files").remove([path]);
}

export async function removeMyOnboardingLink(linkId) {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("onboarding_links")
    .select("url, project_id")
    .eq("id", linkId)
    .maybeSingle();
  if (!row) return { error: "Ссылка не найдена" };
  await requireProjectEditor(row.project_id);
  const { error } = await admin
    .from("onboarding_links")
    .delete()
    .eq("id", linkId);
  if (error) return { error: error.message };
  if (row?.url) await deleteOnboardingStorageFile(admin, row.url);
  revalidatePath("/mop/onboarding-materials");
  revalidatePath("/mop");
  return { success: true };
}
