import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import WheelAdminClient from "@/components/WheelAdminClient";
import ChestAdminClient from "@/components/ChestAdminClient";
import { chestEligible } from "@/lib/chest";

export const dynamic = "force-dynamic";

export default async function AdminWheelPage() {
  const supabase = createClient();
  const admin = createAdminClient();

  const [
    { data: segments },
    { data: config },
    { data: employees },
    { data: spins },
    { data: gifts },
    { data: people },
  ] = await Promise.all([
    supabase
      .from("wheel_segments")
      .select("*")
      .order("sort_order")
      .order("created_at"),
    supabase.from("wheel_config").select("*").eq("id", true).maybeSingle(),
    supabase
      .from("users")
      .select("id, name, role, rop_id")
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
    admin
      .from("chest_gifts")
      .select("id, title, chips, spins, coins, user_id, is_active, created_at, users!chest_gifts_user_id_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(10),
    admin.from("users").select("role, is_active, is_guest, email").eq("is_active", true),
  ]);

  // Сколько человек открыли каждый подарок.
  const giftIds = (gifts ?? []).map((g) => g.id);
  const { data: claims } = giftIds.length
    ? await admin.from("chest_claims").select("gift_id").in("gift_id", giftIds)
    : { data: [] };
  const claimCount = {};
  for (const c of claims ?? []) claimCount[c.gift_id] = (claimCount[c.gift_id] ?? 0) + 1;

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
      <ChestAdminClient
        gifts={(gifts ?? []).map((g) => ({ ...g, recipient: g.users?.name ?? null, claims: claimCount[g.id] ?? 0 }))}
        eligibleCount={(people ?? []).filter(chestEligible).length}
        employees={employees ?? []}
      />
    </div>
  );
}
