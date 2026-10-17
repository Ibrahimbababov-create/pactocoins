"use server";

import { formatCoins } from "@/lib/plural";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { pickSegmentIndex, prizeText, isWheelOpen } from "@/lib/wheel";
import { notifyUser } from "@/lib/notifyUser";
import { recordTeamEvent } from "@/lib/teamEvents";
import { addCoins } from "@/lib/addCoins";
import { addSpins } from "@/lib/addSpins";

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
// только государственный оператор лотерей. Крутки дают за работу.

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
    .select("name, balance, wheel_spins, is_guest")
    .eq("id", user.id)
    .single();

  let balance = profile?.balance ?? 0;
  let spins = profile?.wheel_spins ?? 0;

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
  }

  await admin.from("wheel_spins").insert({
    user_id: user.id,
    segment_id: seg.id,
    segment_label: seg.label,
    prize_type: seg.prize_type,
    prize_amount: seg.prize_amount,
    cost_coins: 0,
  });

  // В ленту/на проектор — только выигрыши, и не от гостя
  if (seg.prize_type !== "nothing" && !profile?.is_guest) {
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
  };
}
