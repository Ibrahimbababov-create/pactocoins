import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Список активных РОПов — для выбора руководителя при регистрации и в
// настройках. Отдаём только id + имя.
export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("id, name")
    .eq("role", "rop")
    .eq("is_active", true)
    .not("email", "like", "%.test@pactocoins.local")
    .order("name");

  return Response.json({ rops: data ?? [] });
}
