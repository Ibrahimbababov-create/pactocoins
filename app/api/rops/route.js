import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// К кому может прийти новый человек: РОП или наставник. Стажёров ведут
// наставники, поэтому при регистрации выбор из обоих списков.
// Отдаём только id, имя и роль.
export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("id, name, role")
    .in("role", ["rop", "mentor"])
    .eq("is_active", true)
    .not("email", "like", "%.test@pactocoins.local")
    .order("role")
    .order("name");

  const leads = data ?? [];

  return Response.json({
    leads,
    // Старое поле: им пользуются настройки, где выбирается именно РОП.
    rops: leads.filter((u) => u.role === "rop"),
  });
}
