import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getLiveData } from "@/lib/tournamentLive";

export const dynamic = "force-dynamic";

// Свежие данные для экрана «Наблюдать за игрой». Экран дёргает этот адрес,
// когда в базе что-то поменялось, и на всякий случай раз в 10 секунд.
export async function GET(_request, { params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const admin = createAdminClient();
  const { data: viewer } = await admin.from("users").select("id, role").eq("id", user.id).single();
  const data = await getLiveData(admin, params.id, viewer);
  if (!data) return NextResponse.json({ error: "Турнир не найден" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
