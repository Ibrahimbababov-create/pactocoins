import { createAdminClient } from "@/lib/supabase-admin";

// Один общий гостевой аккаунт на всех, кто пробует приложение —
// не привязан ни к какому реальному Telegram-аккаунту. Пароль нигде
// не хранится, вычисляется заново каждый раз из service-role ключа
// (никогда не уходит клиенту — используется только в server routes).
export const GUEST_EMAIL = "guest@pactocoins.local";
export const GUEST_PASSWORD = `guest-${(
  process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback"
).slice(0, 24)}`;
export const GUEST_STARTING_BALANCE = 100000;

export async function getOrCreateGuestAccount() {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("is_guest", true)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: GUEST_EMAIL,
    password: GUEST_PASSWORD,
    email_confirm: true,
  });

  // Кто-то уже успел создать гостевой аккаунт параллельно (два первых
  // визита одновременно) — просто находим то, что уже создалось.
  if (createErr) {
    const { data: raceWinner } = await admin
      .from("users")
      .select("id")
      .eq("is_guest", true)
      .maybeSingle();
    if (raceWinner) return raceWinner.id;
    throw new Error(createErr.message);
  }

  const { error: insertErr } = await admin.from("users").insert({
    id: created.user.id,
    name: "Гость",
    email: GUEST_EMAIL,
    role: "mop",
    is_guest: true,
    balance: GUEST_STARTING_BALANCE,
    total_earned: 0,
    month_earned: 0,
  });

  if (insertErr) {
    const { data: raceWinner } = await admin
      .from("users")
      .select("id")
      .eq("is_guest", true)
      .maybeSingle();
    if (raceWinner) return raceWinner.id;
    throw new Error(insertErr.message);
  }

  return created.user.id;
}

// Ночной сброс — гостевой аккаунт общий на всех, кто пробует, поэтому
// каждую ночь возвращаем баланс и подчищаем всё, что натестили.
export async function resetGuestAccount() {
  const admin = createAdminClient();
  const guestId = await getOrCreateGuestAccount();

  await admin.from("purchase_requests").delete().eq("user_id", guestId);
  await admin.from("transactions").delete().eq("user_id", guestId);
  await admin.from("revenue_requests").delete().eq("user_id", guestId);
  await admin.from("bonus_requests").delete().eq("user_id", guestId);

  await admin
    .from("users")
    .update({
      balance: GUEST_STARTING_BALANCE,
      total_earned: 0,
      month_earned: 0,
    })
    .eq("id", guestId);
}
