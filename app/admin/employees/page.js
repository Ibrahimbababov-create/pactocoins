import { createClient } from "@/lib/supabase-server";
import EmployeesClient from "@/components/EmployeesClient";
import { getMonthEarnedMap } from "@/lib/earnings";

export default async function EmployeesPage() {
  const supabase = createClient();

  const [
    { data: users },
    { data: goals },
    { data: obBlocks },
    { data: obProgress },
    { data: projects },
  ] = await Promise.all([
      supabase
        .from("users")
        .select("*")
        .eq("is_guest", false)
        .order("is_active", { ascending: false })
        .order("role", { ascending: false })
        .order("name"),
      supabase.from("user_goals").select("*, rewards(title)").eq("status", "active"),
      supabase.from("onboarding_blocks").select("id, day, required, kind").in("kind", ["article", "test"]),
      supabase.from("onboarding_progress").select("user_id, block_id"),
      supabase
        .from("projects")
        .select("id, name, is_active")
        .order("is_active", { ascending: false })
        .order("name"),
    ]);

  const goalByUser = Object.fromEntries(
    (goals ?? []).map((g) => [g.user_id, g])
  );

  const dayOfBlock = Object.fromEntries((obBlocks ?? []).map((b) => [b.id, b.day]));
  const totalByDay = { 1: 0, 2: 0, 3: 0 };
  for (const b of obBlocks ?? []) if (b.required) totalByDay[b.day]++;
  const obByUser = {};
  for (const p of obProgress ?? []) {
    const day = dayOfBlock[p.block_id];
    if (!day) continue;
    ((obByUser[p.user_id] ||= { 1: 0, 2: 0, 3: 0 })[day])++;
  }

  const monthEarnedMap = await getMonthEarnedMap(supabase, (users ?? []).map((u) => u.id));

  // Для уволенных показываем, сколько выручки они принесли: баланс коинов
  // при увольнении обнуляется, а история оплат остаётся.
  const firedIds = (users ?? []).filter((u) => u.is_active === false).map((u) => u.id);
  const firedRevenue = {};
  // Баланс на момент увольнения: последняя транзакция «Списание при
  // увольнении» (отрицательная, по модулю). У давно уволенных её нет.
  const firedBalance = {};
  if (firedIds.length) {
    const { data: offTx } = await supabase
      .from("transactions")
      .select("user_id, amount_coins, created_at")
      .eq("description", "Списание при увольнении")
      .in("user_id", firedIds)
      .order("created_at", { ascending: false })
      .limit(2000);
    for (const t of offTx ?? []) {
      if (firedBalance[t.user_id] === undefined) firedBalance[t.user_id] = Math.abs(Number(t.amount_coins) || 0);
    }
    const { data: paid } = await supabase
      .from("revenue_requests")
      .select("user_id, amount_kzt")
      .eq("status", "approved")
      .in("user_id", firedIds)
      .limit(5000);
    for (const r of paid ?? []) {
      firedRevenue[r.user_id] = (firedRevenue[r.user_id] ?? 0) + Number(r.amount_kzt ?? 0);
    }
  }

  const usersWithGoals = (users ?? []).map((u) => ({
    ...u,
    fired_revenue: firedRevenue[u.id] ?? 0,
    fired_balance: firedBalance[u.id] ?? null,
    month_earned: monthEarnedMap[u.id] ?? 0,
    goal: goalByUser[u.id] ?? null,
    onboarding:
      u.role === "trainee"
        ? { done: obByUser[u.id] ?? { 1: 0, 2: 0, 3: 0 }, total: totalByDay }
        : null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Сотрудники</h1>
      <EmployeesClient
        users={usersWithGoals}
        projects={projects ?? []}
        mentors={(users ?? []).filter(
          (u) => u.role === "mentor" && u.is_active !== false
        )}
      />
    </div>
  );
}
