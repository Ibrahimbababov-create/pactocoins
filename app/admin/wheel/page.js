import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import WheelAdminClient from "@/components/WheelAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminWheelPage() {
  const supabase = createClient();
  const admin = createAdminClient();

  const [{ data: segments }, { data: config }, { data: employees }, { data: spins }] =
    await Promise.all([
      supabase
        .from("wheel_segments")
        .select("*")
        .order("sort_order")
        .order("created_at"),
      supabase.from("wheel_config").select("*").eq("id", true).maybeSingle(),
      supabase
        .from("users")
        .select("id, name")
        .in("role", ["mop", "rop"])
        .eq("is_active", true)
        .eq("is_guest", false)
        .not("email", "like", "%.test@pactocoins.local")
        .order("name"),
      admin
        .from("wheel_spins")
        .select("id, segment_label, prize_type, prize_amount, created_at, users(name)")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  const recentSpins = (spins ?? []).map((s) => ({
    ...s,
    user_name: s.users?.name ?? "—",
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🎡 Колесо фортуны</h1>
      <WheelAdminClient
        segments={segments ?? []}
        config={config ?? { spin_price_coins: 500, buy_enabled: true }}
        employees={employees ?? []}
        recentSpins={recentSpins}
      />
    </div>
  );
}
