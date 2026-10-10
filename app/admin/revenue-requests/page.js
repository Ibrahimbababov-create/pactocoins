import { createClient } from "@/lib/supabase-server";
import RevenueRequestsClient from "@/components/RevenueRequestsClient";
import { createAdminClient } from "@/lib/supabase-admin";
import { forecastRevenueCoins } from "@/lib/revenueForecast";

const HISTORY_PAGE = 20;

export default async function RevenueRequestsPage() {
  const supabase = createClient();
  const withUser = "*, users!revenue_requests_user_id_fkey(name, email, is_guest)";

  // Ожидающие нужны все — это работа на сегодня. История приезжает
  // порциями по 20: раньше страница тянула все 329 записей разом.
  const [{ data: pending }, { data: history }, { count: historyCount }] =
    await Promise.all([
      supabase
        .from("revenue_requests")
        .select(withUser)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("revenue_requests")
        .select(withUser)
        .neq("status", "pending")
        .order("created_at", { ascending: false })
        .range(0, HISTORY_PAGE - 1),
      supabase
        .from("revenue_requests")
        .select("*", { count: "exact", head: true })
        .neq("status", "pending"),
    ]);

  // Для очереди — сколько реально начислится по шкале месяца.
  const forecast = await forecastRevenueCoins(createAdminClient(), pending);
  const pendingWithForecast = (pending ?? []).map((r) => ({
    ...r,
    forecast_coins: forecast[r.id] ?? null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Заявки на выручку</h1>
      <RevenueRequestsClient
        requests={[...pendingWithForecast, ...(history ?? [])]}
        historyTotal={historyCount ?? 0}
        historyPageSize={HISTORY_PAGE}
      />
    </div>
  );
}
