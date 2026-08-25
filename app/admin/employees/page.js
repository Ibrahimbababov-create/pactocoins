import { createClient } from "@/lib/supabase-server";
import EmployeesClient from "@/components/EmployeesClient";

export default async function EmployeesPage() {
  const supabase = createClient();

  const [{ data: users }, { data: goals }] = await Promise.all([
    supabase
      .from("users")
      .select("*")
      .eq("is_guest", false)
      .order("is_active", { ascending: false })
      .order("role", { ascending: false })
      .order("name"),
    supabase.from("user_goals").select("*, rewards(title)").eq("status", "active"),
  ]);

  const goalByUser = Object.fromEntries(
    (goals ?? []).map((g) => [g.user_id, g])
  );

  const usersWithGoals = (users ?? []).map((u) => ({
    ...u,
    goal: goalByUser[u.id] ?? null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Сотрудники</h1>
      <EmployeesClient users={usersWithGoals} />
    </div>
  );
}
