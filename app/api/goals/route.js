import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getEffectivePrice } from "@/lib/rewardPricing";

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const rewardId = body.rewardId;

  if (!rewardId) {
    return NextResponse.json({ error: "Выбери награду" }, { status: 400 });
  }

  const { data: reward } = await supabase
    .from("rewards")
    .select("*")
    .eq("id", rewardId)
    .eq("is_active", true)
    .single();

  if (!reward || reward.is_variable) {
    return NextResponse.json(
      { error: "Эту награду нельзя поставить целью" },
      { status: 400 }
    );
  }

  const { effectivePrice } = getEffectivePrice(reward);

  // У человека в любой момент максимум одна активная цель — если
  // уже есть, просто меняем её на новую награду, а не заводим вторую.
  const { data: existing } = await supabase
    .from("user_goals")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const payload = {
    user_id: user.id,
    reward_id: rewardId,
    target_amount: effectivePrice,
    status: "active",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = existing
    ? await supabase
        .from("user_goals")
        .update(payload)
        .eq("id", existing.id)
        .select("*, rewards(title, image_url)")
        .single()
    : await supabase
        .from("user_goals")
        .insert(payload)
        .select("*, rewards(title, image_url)")
        .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal: data });
}
