import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import WheelClient from "@/components/WheelClient";
import Icon from "@/components/Icon";
import GameHeader from "@/components/GameHeader";
import { isWheelOpen, formatOpensAt } from "@/lib/wheel";

export const dynamic = "force-dynamic";

// Крупные выигрыши других — для витрины внизу. Последние 7 дней,
// без админов (тестовые прокрутки не должны выглядеть как призы игроков).
const SHOWCASE_MIN_COINS = 300;
const SHOWCASE_DAYS = 7;

export default async function WheelPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: config } = await supabase
    .from("wheel_config")
    .select("is_open, opens_at, spin_price_chips")
    .eq("id", true)
    .maybeSingle();

  const wheelClosed = !isWheelOpen(config);

  const admin = createAdminClient();
  const showcaseSince = new Date(
    Date.now() - SHOWCASE_DAYS * 86400000
  ).toISOString();

  const [{ data: profile }, { data: segments }, { data: wins }] =
    await Promise.all([
      wheelClosed
        ? Promise.resolve({ data: null })
        : supabase
            .from("users")
            .select("balance, wheel_spins, chips")
            .eq("id", user.id)
            .single(),
      wheelClosed
        ? Promise.resolve({ data: [] })
        : supabase
            .from("wheel_segments")
            .select("id, label, weight, prize_type, prize_amount, color, sort_order")
            .eq("is_active", true)
            .order("sort_order")
            .order("created_at"),
      admin
        .from("wheel_spins")
        // Фильтруем в запросе, а не после limit(8): иначе пачка гостевых
        // джекпотов вытесняла настоящие выигрыши, а сами гостевые
        // попадали в витрину, которую видит вся команда.
        .select("id, segment_label, prize_amount, created_at, users!inner(name, role, is_guest, email)")
        .eq("users.is_guest", false)
        .neq("users.role", "admin")
        .not("users.email", "like", "%.test@pactocoins.local")
        .eq("prize_type", "coins")
        .gte("prize_amount", SHOWCASE_MIN_COINS)
        .gte("created_at", showcaseSince)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const bigWins = (wins ?? [])
    .map((w) => ({
      id: w.id,
      name: w.users?.name ?? null,
      role: w.users?.role,
      label: w.segment_label,
      amount: w.prize_amount,
      created_at: w.created_at,
    }))
    .filter((w) => w.name);

  return (
    <div className="space-y-4">
      <GameHeader title="Колесо фортуны" />

      {wheelClosed ? (
        <div className="rounded-2xl border border-dark-600 bg-dark-800 text-center py-10 px-4">
          <Icon name="wheel" className="w-10 h-10 mx-auto text-gray-500" />
          <h2 className="mt-3 font-bold">Колесо фортуны закрыто</h2>
          <p className="text-gray-500 text-sm mt-1">
            {formatOpensAt(config?.opens_at)
              ? `Откроется ${formatOpensAt(config.opens_at)}.`
              : "Скоро откроем."}
          </p>
        </div>
      ) : (
        <WheelClient
          segments={segments ?? []}
          spins={profile?.wheel_spins ?? 0}
          balance={profile?.balance ?? 0}
          chips={profile?.chips ?? 0}
          chipPrice={config?.spin_price_chips ?? 10}
          bigWins={bigWins}
        />
      )}
    </div>
  );
}
