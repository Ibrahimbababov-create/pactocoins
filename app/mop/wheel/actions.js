"use server";

import { formatCoins, chipsNom } from "@/lib/plural";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { pickSegmentIndex, prizeText, isWheelOpen } from "@/lib/wheel";
import { notifyUser, escapeHtml } from "@/lib/notifyUser";
import { recordTeamEvent } from "@/lib/teamEvents";
import { addCoins } from "@/lib/addCoins";
import { addSpins } from "@/lib/addSpins";
import { addChips } from "@/lib/addChips";
import { sendTelegramMessage } from "@/lib/telegramBot";

async function currentUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");
  return user;
}

// Купить крутки за коины больше нельзя (октябрь 2026): платная крутка со
// случайным выигрышем похожа на ставку, а розыгрыши в Казахстане проводит
// только государственный оператор лотерей. Крутки покупают за фишки:
// игровую валюту, которая выпадает на колесе и ничего не стоит (её нельзя
// купить за коины и обменять на коины). Цена и списание — в SQL
// buy_spins_with_chips, одним запросом.
export async function buySpinsWithChips(count = 1) {
  const user = await currentUser();
  const admin = createAdminClient();
  const n = Math.max(1, Math.min(50, Math.round(Number(count) || 1)));

  const { data: cfg } = await admin.from("wheel_config").select("is_open, opens_at").eq("id", true).maybeSingle();
  if (!isWheelOpen(cfg)) return { error: "Колесо сейчас закрыто" };

  const { data: res, error } = await admin.rpc("buy_spins_with_chips", { uid: user.id, n });
  if (error) return { error: "Не получилось купить, попробуй ещё раз" };
  if (res?.error === "not_enough") return { error: `Нужно ${res.cost} ${chipsNom(res.cost)}` };
  if (!res?.ok) return { error: "Не получилось купить, попробуй ещё раз" };

  revalidatePath("/mop/games/wheel");
  return { success: true, chips: res.chips, spins: res.spins, cost: res.cost };
}

// Прокрутить колесо. Результат решается ЗДЕСЬ, до анимации на клиенте.
export async function spinWheel() {
  const user = await currentUser();
  const admin = createAdminClient();

  const [{ data: cfg }, { data: segments }] = await Promise.all([
    admin.from("wheel_config").select("*").eq("id", true).maybeSingle(),
    admin
      .from("wheel_segments")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at"),
  ]);

  if (!isWheelOpen(cfg)) return { error: "Колесо сейчас закрыто" };
  if (!segments?.length) return { error: "Колесо ещё не настроено" };

  // Атомарно забираем одну крутку
  const { data: consumed, error: consumeErr } = await admin.rpc(
    "consume_wheel_spin",
    { uid: user.id }
  );
  if (consumeErr) return { error: "Не получилось прокрутить" };
  if (!consumed) return { error: "Нет доступных круток" };

  const idx = pickSegmentIndex(segments);
  const seg = segments[idx];

  const { data: profile } = await admin
    .from("users")
    .select("name, balance, wheel_spins, chips, is_guest, role")
    .eq("id", user.id)
    .single();

  let balance = profile?.balance ?? 0;
  let spins = profile?.wheel_spins ?? 0;
  let chips = profile?.chips ?? 0;

  if (seg.prize_type === "coins" && seg.prize_amount > 0) {
    const credited = await addCoins(admin, user.id, seg.prize_amount);
    balance = credited.balance ?? balance + seg.prize_amount;
    await admin.from("transactions").insert({
      user_id: user.id,
      type: "manual_add",
      amount_coins: seg.prize_amount,
      description: `🎡 Колесо фортуны: +${formatCoins(seg.prize_amount)}`,
      rating_exempt: true,
    });
  } else if (seg.prize_type === "spins" && seg.prize_amount > 0) {
    const added = await addSpins(admin, user.id, seg.prize_amount);
    spins = added.spins ?? spins + seg.prize_amount;
  } else if (seg.prize_type === "chips" && seg.prize_amount > 0) {
    const added = await addChips(admin, user.id, seg.prize_amount, "Колесо фортуны");
    chips = added.chips ?? chips + seg.prize_amount;
  }

  // Джекпот (самый крупный приз коинами) — на всю команду, в общую группу.
  const top = Math.max(0, ...segments.filter((s) => s.prize_type === "coins").map((s) => s.prize_amount || 0));
  const jackpot = seg.prize_type === "coins" && seg.prize_amount === top && top >= 500;
  if (jackpot && !profile?.is_guest && profile?.role !== "admin") {
    const chat = process.env.TELEGRAM_ANNOUNCE_CHAT_ID;
    if (chat) {
      const thread = process.env.TELEGRAM_ANNOUNCE_THREAD_ID ? Number(process.env.TELEGRAM_ANNOUNCE_THREAD_ID) : undefined;
      try {
        await sendTelegramMessage(
          chat,
          `💥 Джекпот на колесе фортуны! <b>${escapeHtml(profile?.name ?? "Кто-то")}</b> забирает ${formatCoins(seg.prize_amount)}.`,
          undefined,
          thread
        );
      } catch (err) {
        console.error("[wheel] jackpot announce failed", err);
      }
    }
  }

  await admin.from("wheel_spins").insert({
    user_id: user.id,
    segment_id: seg.id,
    segment_label: seg.label,
    prize_type: seg.prize_type,
    prize_amount: seg.prize_amount,
    cost_coins: 0,
  });

  // В ленту/на проектор — только заметные выигрыши коинами, и не от гостя
  // и не от админа (у тестового «Админ» бесконечные крутки «для интереса»,
  // его прокрутки никуда не идут). Мелкие фишки ленту бы заспамили.
  if (seg.prize_type === "coins" && seg.prize_amount >= 100 && !profile?.is_guest && profile?.role !== "admin") {
    await recordTeamEvent(admin, {
      userId: user.id,
      userName: profile?.name ?? "Кто-то",
      kind: "wheel",
      title: `${seg.label} на колесе фортуны`,
      icon: "🎡",
    });
  }

  if (seg.prize_type === "custom") {
    await notifyUser(
      admin,
      user.id,
      `🎡 Колесо фортуны: выпало «${seg.label}». Админ свяжется по призу.`,
      "notify_shop"
    );
  }

  revalidatePath("/mop/games");
  revalidatePath("/mop/games/wheel");
  revalidatePath("/mop");

  return {
    success: true,
    index: idx,
    label: seg.label,
    prizeType: seg.prize_type,
    prizeAmount: seg.prize_amount,
    resultText: prizeText(seg.prize_type, seg.prize_amount),
    balance,
    spins,
    chips,
    jackpot,
  };
}
