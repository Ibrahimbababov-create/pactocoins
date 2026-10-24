"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  tournamentError,
  reportResult,
  confirmResult,
  disputeResult,
} from "@/lib/tournament";
import { notifyJoined } from "@/lib/tournamentNotify";

async function me() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, is_guest, is_active, clash_tag, clash_name")
    .eq("id", user.id)
    .single();
  return profile ? { admin, profile } : null;
}

function refresh(tid) {
  revalidatePath("/mop/games");
  if (tid) revalidatePath(`/mop/games/tournament/${tid}`);
  revalidatePath("/mop");
}

// Тег из игры: «Профиль → под ником», вида #2PYLQ8. Буква O — это ноль.
function normalizeClashTag(raw) {
  const s = String(raw ?? "")
    .toUpperCase()
    .replace(/[\s#]/g, "")
    .replace(/O/g, "0");
  return s ? `#${s}` : "";
}

export async function saveClashTag(raw) {
  const ctx = await me();
  if (!ctx) return { error: "Не авторизован" };
  if (ctx.profile.is_guest) return { error: "В гостевом режиме тег не сохраняется" };
  const tag = normalizeClashTag(raw);
  if (!/^#[0289PYLQGRJCUV]{3,14}$/.test(tag)) {
    return { error: "Не похоже на тег. Он в игре: профиль, под ником, например #2PYLQ8" };
  }
  const { error } = await ctx.admin.from("users").update({ clash_tag: tag }).eq("id", ctx.profile.id);
  if (error) {
    if (/users_clash_tag_uniq|duplicate/i.test(error.message)) return { error: "Этот тег уже у другого сотрудника" };
    return { error: error.message };
  }
  refresh();
  revalidatePath("/mop/settings");
  return { ok: true, tag };
}

// Ник и тег можно поправить и после записи: над ареной в бою видно ник, а
// не имя, да и в тег нередко попадает тег клана вместо своего. Чинить это
// через админа — лишний круг, человек должен справиться сам.
export async function saveClashProfile(tid, nameRaw, tagRaw) {
  const ctx = await me();
  if (!ctx) return { error: "Не авторизован" };
  if (ctx.profile.is_guest) return { error: "В гостевом режиме это не сохраняется" };
  const clashName = String(nameRaw ?? "").trim().slice(0, 40);
  if (!clashName) return { error: "Впиши ник, как он написан в игре" };

  // Ник сохраняем первым: если человек заодно опечатался в теге, ник не
  // должен потеряться вместе с ошибкой.
  const { error } = await ctx.admin.from("users").update({ clash_name: clashName }).eq("id", ctx.profile.id);
  if (error) return { error: error.message };

  const tag = normalizeClashTag(tagRaw ?? "");
  let tagError = null;
  if (tag && tag !== ctx.profile.clash_tag) {
    const saved = await saveClashTag(tagRaw);
    if (saved.error) tagError = saved.error;
  }
  if (tid) {
    await ctx.admin
      .from("tournament_entries")
      .update({
        clash_name: clashName,
        clash_tag: (tagError ? ctx.profile.clash_tag : tag) || ctx.profile.clash_tag || null,
      })
      .eq("tournament_id", tid)
      .eq("user_id", ctx.profile.id);
  }
  refresh(tid);
  revalidatePath("/mop/settings");
  if (tagError) return { error: `Ник сохранил. С тегом не вышло: ${tagError}` };
  return { ok: true, clashName, tag: tag || ctx.profile.clash_tag || null };
}

export async function joinTournament(tid, tagRaw, nameRaw) {
  const ctx = await me();
  if (!ctx) return { error: "Не авторизован" };
  if (ctx.profile.is_guest) return { error: "В гостевом режиме участвовать нельзя" };

  // Тег можно ввести прямо при записи.
  if (tagRaw && normalizeClashTag(tagRaw) !== ctx.profile.clash_tag) {
    const saved = await saveClashTag(tagRaw);
    if (saved.error) return saved;
  }

  // Ник в игре: по тегу человека находят, а в бою над ареной видно ник.
  // Без него пара «Нурбек против Абдрахима» в зале не читается.
  const clashName = String(nameRaw ?? "").trim().slice(0, 40);
  if (clashName && clashName !== ctx.profile.clash_name) {
    await ctx.admin.from("users").update({ clash_name: clashName }).eq("id", ctx.profile.id);
  }

  const { data: res, error } = await ctx.admin.rpc("tournament_join", { p_tid: tid, p_uid: ctx.profile.id });
  if (error) return { error: error.message };
  if (res?.error) return { error: tournamentError(res.error), code: res.error };

  // Ник и тег кладём и в саму запись: состав турнира не должен меняться,
  // если человек потом поменяет ник в профиле.
  await ctx.admin
    .from("tournament_entries")
    .update({ clash_name: clashName || ctx.profile.clash_name || null })
    .eq("tournament_id", tid)
    .eq("user_id", ctx.profile.id);

  const { data: t } = await ctx.admin.from("tournaments").select("*").eq("id", tid).single();
  if (t) await notifyJoined(ctx.admin, t, ctx.profile.id);
  refresh(tid);
  return { ok: true, balance: res.balance, count: res.count };
}

export async function withdrawFromTournament(tid) {
  const ctx = await me();
  if (!ctx) return { error: "Не авторизован" };
  const { data: res, error } = await ctx.admin.rpc("tournament_withdraw", {
    p_tid: tid,
    p_uid: ctx.profile.id,
    p_actor: ctx.profile.id,
  });
  if (error) return { error: error.message };
  if (res?.error) return { error: tournamentError(res.error) };
  refresh(tid);
  return { ok: true, refunded: res.refunded };
}

async function matchAction(matchId, fn) {
  const ctx = await me();
  if (!ctx) return { error: "Не авторизован" };
  const res = await fn(ctx.admin, matchId, ctx.profile.id);
  const { data: m } = await ctx.admin
    .from("tournament_matches")
    .select("tournament_id")
    .eq("id", matchId)
    .maybeSingle();
  refresh(m?.tournament_id);
  return res;
}

// seen — сколько записей в журнале боёв было на экране у человека: так
// второй тап по тому же бою не засчитается как следующий бой серии.
const seenOf = (v) => (Number.isInteger(v) && v >= 0 ? v : null);

export async function reportMatch(matchId, outcome, seen = null) {
  if (outcome !== "won" && outcome !== "lost") return { error: "Неизвестный итог" };
  return matchAction(matchId, (admin, id, uid) => reportResult(admin, id, uid, outcome, seenOf(seen)));
}

export async function confirmMatch(matchId, seen = null) {
  return matchAction(matchId, (admin, id, uid) => confirmResult(admin, id, uid, seenOf(seen)));
}

export async function disputeMatch(matchId, note, seen = null) {
  return matchAction(matchId, (admin, id, uid) => disputeResult(admin, id, uid, note, seenOf(seen)));
}
