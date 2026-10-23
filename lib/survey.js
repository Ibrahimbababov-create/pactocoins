import { randomUUID } from "crypto";
import { almatyDayKey } from "@/lib/timezone";
import { SURVEY_ID } from "@/lib/surveyQuestions";
import { chestEligible } from "@/lib/chest";

// Хранилище кастдева. Схему базы не трогаем: всё лежит файлами в закрытом
// бакете app-config (как настройки «Сверки» и прихода), читает только сервер.
//
//   survey/<id>/config.json        открыт ли опрос
//   survey/<id>/answers/<uuid>.json один ответ, БЕЗ имени и аккаунта
//   survey/<id>/done/<userId>.json  отметка «этот человек прошёл», без ответов
//
// Ответ и отметка не связаны ничем, кроме момента записи, поэтому в админке
// видно, сколько человек прошли, но не кто что ответил. Отметка нужна, чтобы
// фишки начислить один раз: файл создаётся с upsert: false, второй раз
// одновременно записать его физически нельзя (как «захват» заявки).

const BUCKET = "app-config";
const DIR = `survey/${SURVEY_ID}`;

const store = (admin) => admin.storage.from(BUCKET);

async function ensureBucket(admin) {
  const { data: buckets } = await admin.storage.listBuckets();
  if ((buckets ?? []).some((b) => b.id === BUCKET)) return null;
  const { error } = await admin.storage.createBucket(BUCKET, { public: false });
  return error && !/exists/i.test(error.message) ? error.message : null;
}

export async function getSurveyConfig(admin) {
  try {
    const { data, error } = await store(admin).download(`${DIR}/config.json`);
    if (error || !data) return { open: false };
    return { open: JSON.parse(await data.text())?.open === true };
  } catch {
    return { open: false };
  }
}

export async function saveSurveyOpen(admin, open) {
  const bucketError = await ensureBucket(admin);
  if (bucketError) return { error: bucketError };
  const { error } = await store(admin).upload(
    `${DIR}/config.json`,
    JSON.stringify({ open: Boolean(open), updatedAt: new Date().toISOString() }),
    { contentType: "application/json", upsert: true }
  );
  return error ? { error: error.message } : { ok: true };
}

export async function hasDone(admin, userId) {
  const file = `${userId}.json`;
  const { data } = await store(admin).list(`${DIR}/done`, { limit: 5, search: file });
  return (data ?? []).some((f) => f.name === file);
}

// { ok } — отметка поставлена, { exists } — уже проходил, { error }.
export async function claimDone(admin, userId) {
  const bucketError = await ensureBucket(admin);
  if (bucketError) return { error: bucketError };
  const { error } = await store(admin).upload(`${DIR}/done/${userId}.json`, "{}", {
    contentType: "application/json",
    upsert: false,
  });
  if (!error) return { ok: true };
  if (String(error.statusCode) === "409" || /already exists|duplicate/i.test(error.message ?? "")) {
    return { exists: true };
  }
  return { error: error.message };
}

export async function releaseDone(admin, userId) {
  await store(admin).remove([`${DIR}/done/${userId}.json`]);
}

export async function saveResponse(admin, answers) {
  const id = randomUUID();
  const { error } = await store(admin).upload(
    `${DIR}/answers/${id}.json`,
    JSON.stringify({ id, day: almatyDayKey(new Date()), answers }),
    { contentType: "application/json", upsert: false }
  );
  return error ? { error: error.message } : { ok: true };
}

async function listAll(admin, dir) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data } = await store(admin).list(dir, { limit: 1000, offset });
    if (!data?.length) break;
    out.push(...data.filter((f) => f.name.endsWith(".json")));
    if (data.length < 1000) break;
  }
  return out;
}

export async function countDone(admin) {
  return (await listAll(admin, `${DIR}/done`)).length;
}

// Все ответы. Порядок случайный по имени файла, а не по времени: так по
// порядку ответов нельзя понять, кто за кем проходил.
export async function loadResponses(admin) {
  const files = await listAll(admin, `${DIR}/answers`);
  const out = [];
  for (let i = 0; i < files.length; i += 10) {
    const batch = await Promise.all(
      files.slice(i, i + 10).map(async (f) => {
        try {
          const { data } = await store(admin).download(`${DIR}/answers/${f.name}`);
          return data ? JSON.parse(await data.text()) : null;
        } catch {
          return null;
        }
      })
    );
    out.push(...batch.filter(Boolean));
  }
  return out;
}

// Показывать ли человеку карточку «Опрос команды» (главная и «Ещё»):
// опрос открыт, человек живой сотрудник и ещё не прошёл. Любой сбой —
// просто без карточки, главную это ронять не должно.
export async function showSurveyCard(admin, userId) {
  try {
    const { data: me } = await admin
      .from("users")
      .select("id, role, is_active, is_guest, email")
      .eq("id", userId)
      .single();
    if (!chestEligible(me)) return false;
    if (!(await getSurveyConfig(admin)).open) return false;
    return !(await hasDone(admin, userId));
  } catch {
    return false;
  }
}
