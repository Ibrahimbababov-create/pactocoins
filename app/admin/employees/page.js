import { createClient } from "@/lib/supabase-server";
import EmployeesClient from "@/components/EmployeesClient";

export default async function EmployeesPage() {
  const supabase = createClient();

  const [{ data: users }, { data: goals }, { data: obBlocks }, { data: obProgress }] =
    await Promise.all([
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

  const usersWithGoals = (users ?? []).map((u) => ({
    ...u,
    goal: goalByUser[u.id] ?? null,
    onboarding:
      u.role === "trainee"
        ? { done: obByUser[u.id] ?? { 1: 0, 2: 0, 3: 0 }, total: totalByDay }
        : null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Сотрудники</h1>
      <EmployeesClient users={usersWithGoals} />
    </div>
  );
}
