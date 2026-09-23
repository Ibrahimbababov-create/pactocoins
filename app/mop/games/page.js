import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import WheelClient from "@/components/WheelClient";
import Icon from "@/components/Icon";
import { isWheelOpen, formatOpensAt } from "@/lib/wheel";

export const dynamic = "force-dynamic";

// Крупные выигрыши других — для витрины внизу. Последние 7 дней,
// без админов (тестовые прокрутки не должны выглядеть как призы игроков).
const SHOWCASE_MIN_COINS = 300;
const SHOWCASE_DAYS = 7;

function DailyChestTeaser() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dark-600 bg-dark-800 p-4 opacity-70">
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-dark-700 text-gray-500">
          <Icon name="chest" className="w-6 h-6" />
        </span>
        <div>
          <p className="font-bold text-gray-300">Сундук дня</p>
          <p className="text-xs text-gray-500">Скоро — заходи каждый день за призом</p>
        </div>
      </div>
    </div>
  );
}

function MoreGamesTeaser() {
  return (
    <div className="rounded-2xl border border-dashed border-dark-600 p-4 text-center">
      <p className="text-sm text-gray-500">Здесь появятся мини-игры</p>
    </div>
  );
}

export default async function GamesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: config } = await supabase
    .from("wheel_config")
    .select("spin_price_coins, buy_enabled, is_open, opens_at")
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
            .select("balance, wheel_spins")
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
        .select("id, segment_label, prize_amount, created_at, users(name, role)")
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
    .filter((w) => w.name && w.role !== "admin" && !w.name.startsWith("🤖"));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display font-bold">Игры</h1>

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
          config={config ?? { spin_price_coins: 150, buy_enabled: false }}
          bigWins={bigWins}
        />
      )}

      <DailyChestTeaser />
      <MoreGamesTeaser />
    </div>
  );
}
