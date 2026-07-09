import { createClient } from "@/lib/supabase-server";
import EmployeesClient from "@/components/EmployeesClient";

export default async function EmployeesPage() {
  const supabase = createClient();

  const { data: users } = await supabase
    .from("users")
    .select("*")
    .order("role", { ascending: false })
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Сотрудники</h1>
      <EmployeesClient users={users ?? []} />
    </div>
  );
}
