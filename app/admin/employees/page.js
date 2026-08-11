import { createClient } from "@/lib/supabase-server";
import EmployeesClient from "@/components/EmployeesClient";
import { currentMonthEndAlmaty } from "@/lib/timezone";

export default async function EmployeesPage() {
  const supabase = createClient();

  const { data: users } = await supabase
    .from("users")
    .select("*")
    .order("role", { ascending: false })
    .order("name");

  const { data: goals } = await supabase
    .from("user_goals")
    .select("*")
    .eq("deadline", currentMonthEndAlmaty());

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
