import { createClient } from "@/lib/supabase-server";
import PaymentsClient from "@/components/PaymentsClient";

export default async function PaymentsPage() {
  const supabase = createClient();

  const [{ data: employees }, { data: rows }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name")
      .in("role", ["mop", "rop", "trainee"])
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local")
      .order("name"),
    supabase
      .from("revenue_requests")
      .select("*, users!revenue_requests_user_id_fkey(name)")
      .eq("status", "approved")
      .order("earned_at", { ascending: false, nullsFirst: false })
      .limit(30),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold">Оплаты</h1>
        <p className="text-sm text-gray-500 mt-1">
          Здесь можно найти конкретную оплату и поправить её: изменить сумму,
          передвинуть дату или отменить. Коины пересчитываются сами, сотруднику
          уходит сообщение.
        </p>
      </div>

      <PaymentsClient employees={employees ?? []} initialRows={rows ?? []} />
    </div>
  );
}
