"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { almatyDatetimeToUtcIso } from "@/lib/timezone";
import {
  tournamentError,
  startTournament,
  adminDecide,
  adminReplay,
  adminExtend,
} from "@/lib/tournament";
import { announceRegistration, notifyCancelled } from "@/lib/tournamentNotify";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Доступ запрещён");
  return user;
}

function refresh(tid) {
  revalidatePath("/admin/tournaments");
  if (tid) {
    revalidatePath(`/admin/tournaments/${tid}`);
    revalidatePath(`/mop/games/tournament/${tid}`);
  }
  revalidatePath("/mop/games");
}

const int = (v, min, max, dflt) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
};

// Поля формы → строка tournaments. Взнос меняется только в черновике.
function fields(form, { withFee }) {
  const title = String(form.title ?? "").trim().slice(0, 80);
  if (!title) return { error: "Впиши название" };
  const ends = String(form.registration_ends_at ?? "").trim();
  const row = {
    title,
    description: String(form.description ?? "").trim().slice(0, 1000) || null,
    bonus_coins: int(form.bonus_coins, 0, 100000, 0),
    max_players: form.max_players ? int(form.max_players, 2, 64, null) : null,
    min_players: int(form.min_players, 2, 64, 2),
    registration_ends_at: ends ? almatyDatetimeToUtcIso(ends) : null,
    round_hours: int(form.round_hours, 1, 168, 24),
    confirm_hours: int(form.confirm_hours, 0, 72, 6),
    clan_tag: String(form.clan_tag ?? "").trim().slice(0, 40) || null,
    is_test: Boolean(form.is_test),
  };
  if (withFee) row.entry_fee = int(form.entry_fee, 0, 5000, 0);
  return { row };
}

export async function createTournament(form) {
  const user = await requireAdmin();
  const { row, error } = fields(form, { withFee: true });
  if (error) return { error };
  const admin = createAdminClient();
  const { data, error: insErr } = await admin
    .from("tournaments")
    .insert({ ...row, created_by: user.id, status: "draft" })
    .select("id")
    .single();
  if (insErr) return { error: insErr.message };
  refresh(data.id);
  return { ok: true, id: data.id };
}

export async function updateTournament(tid, form) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: t } = await admin.from("tournaments").select("status").eq("id", tid).single();
  if (!t) return { error: "Турнир не найден" };
  if (!["draft", "registration"].includes(t.status)) return { error: "После старта настройки не меняются" };
  const { row, error } = fields(form, { withFee: t.status === "draft" });
  if (error) return { error };
  const { error: updErr } = await admin
    .from("tournaments")
    .update(row)
    .eq("id", tid)
    .in("status", ["draft", "registration"]);
  if (updErr) return { error: updErr.message };
  refresh(tid);
  return { ok: true };
}

export async function openRegistration(tid) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("tournaments")
    .update({ status: "registration" })
    .eq("id", tid)
    .eq("status", "draft")
    .select("*");
  const t = data?.[0];
  if (!t) return { error: "Запись уже открыта" };
  await announceRegistration(t);
  refresh(tid);
  return { ok: true };
}

export async function startTournamentAction(tid) {
  await requireAdmin();
  const res = await startTournament(createAdminClient(), tid);
  refresh(tid);
  return res;
}

export async function cancelTournament(tid) {
  const user = await requireAdmin();
  const admin = createAdminClient();
  const { data: res, error } = await admin.rpc("tournament_cancel", { p_tid: tid, p_actor: user.id });
  if (error) return { error: error.message };
  if (res?.error) return { error: tournamentError(res.error) };
  const { data: t } = await admin.from("tournaments").select("*").eq("id", tid).single();
  if (t) await notifyCancelled(admin, t, res.refunded ?? []);
  refresh(tid);
  return { ok: true, refunded: (res.refunded ?? []).length };
}

export async function removeEntry(tid, userId) {
  const user = await requireAdmin();
  const admin = createAdminClient();
  const { data: res, error } = await admin.rpc("tournament_withdraw", {
    p_tid: tid,
    p_uid: userId,
    p_actor: user.id,
  });
  if (error) return { error: error.message };
  if (res?.error) return { error: tournamentError(res.error) };
  refresh(tid);
  return { ok: true };
}

async function withMatch(matchId, fn) {
  const user = await requireAdmin();
  const admin = createAdminClient();
  const res = await fn(admin, user.id);
  const { data: m } = await admin.from("tournament_matches").select("tournament_id").eq("id", matchId).maybeSingle();
  refresh(m?.tournament_id);
  return res;
}

export async function decideMatch(matchId, winnerId, walkover = false) {
  return withMatch(matchId, (admin, actor) => adminDecide(admin, matchId, winnerId, actor, walkover ? "walkover" : "admin"));
}

export async function replayMatch(matchId) {
  return withMatch(matchId, (admin) => adminReplay(admin, matchId));
}

export async function extendMatch(matchId, hours = 12) {
  return withMatch(matchId, (admin) => adminExtend(admin, matchId, int(hours, 1, 72, 12)));
}
