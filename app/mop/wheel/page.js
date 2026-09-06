import { createClient } from "@/lib/supabase-server";
import WheelClient from "@/components/WheelClient";

export const dynamic = "force-dynamic";

export default async function WheelPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: segments }, { data: config }] =
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
      supabase
        .from("wheel_config")
        .select("spin_price_coins, buy_enabled")
        .eq("id", true)
        .maybeSingle(),
    ]);

  return (
    <WheelClient
      segments={segments ?? []}
      spins={profile?.wheel_spins ?? 0}
      balance={profile?.balance ?? 0}
      config={config ?? { spin_price_coins: 500, buy_enabled: false }}
    />
  );
}
