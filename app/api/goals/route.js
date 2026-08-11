import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { currentMonthEndAlmaty } from "@/lib/timezone";

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const targetAmount = Number(body.targetAmount);

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return NextResponse.json(
      { error: "Укажи целевую сумму больше нуля" },
      { status: 400 }
    );
  }

  const deadline = currentMonthEndAlmaty();

  const { data: existing } = await supabase
    .from("user_goals")
    .select("*")
    .eq("user_id", user.id)
    .eq("deadline", deadline)
    .maybeSingle();

  if (existing?.status === "active") {
    return NextResponse.json(
      { error: "План на этот месяц уже активен" },
      { status: 409 }
    );
  }

  if (existing?.status === "achieved" && targetAmount <= existing.target_amount) {
    return NextResponse.json(
      { error: "Новая цель должна быть выше текущей" },
      { status: 400 }
    );
  }

  const payload = {
    user_id: user.id,
    target_amount: targetAmount,
    deadline,
    status: "active",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = existing
    ? await supabase
        .from("user_goals")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single()
    : await supabase.from("user_goals").insert(payload).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal: data });
}
