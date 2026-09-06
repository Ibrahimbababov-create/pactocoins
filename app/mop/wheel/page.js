import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import WheelClient from "@/components/WheelClient";
import { isWheelOpen, formatOpensAt } from "@/lib/wheel";

export const dynamic = "force-dynamic";

// Крупные выигрыши других — для витрины внизу.
const SHOWCASE_MIN_COINS = 300;

export default async function WheelPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: config } = await supabase
    .from("wheel_config")
    .select("spin_price_coins, buy_enabled, is_open, opens_at")
    .eq("id", true)
    .maybeSingle();

  if (!isWheelOpen(config)) {
    const when = formatOpensAt(config?.opens_at);
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-5xl mb-4">🎡</p>
        <h1 className="text-2xl font-bold">Колесо фортуны закрыто</h1>
        <p className="text-gray-500 text-sm mt-2">
          {when ? `Откроется ${when}.` : "Скоро откроем."}
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  const [{ data: profile }, { data: segments }, { data: wins }] =
    await Promise.all([
      supabase
        .from("users")
        .select("balance, wheel_spins")
        .eq("id", user.id)
        .single(),
      supabase
        .from("wheel_segments")
        .select("id, label, weight, prize_type, prize_amount, color, sort_order")
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at"),
      admin
        .from("wheel_spins")
        .select("id, segment_label, prize_amount, created_at, users(name)")
        .eq("prize_type", "coins")
        .gte("prize_amount", SHOWCASE_MIN_COINS)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const bigWins = (wins ?? [])
    .map((w) => ({
      id: w.id,
      name: w.users?.name ?? null,
      label: w.segment_label,
      amount: w.prize_amount,
      created_at: w.created_at,
    }))
    .filter((w) => w.name && !w.name.startsWith("🤖"));

  return (
    <WheelClient
      segments={segments ?? []}
      spins={profile?.wheel_spins ?? 0}
      balance={profile?.balance ?? 0}
      config={config ?? { spin_price_coins: 150, buy_enabled: false }}
      bigWins={bigWins}
    />
  );
}
