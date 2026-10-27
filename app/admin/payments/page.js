import { createClient } from "@/lib/supabase-server";
import PaymentsClient from "@/components/PaymentsClient";
import { almatyDayKey, currentMonthKeyAlmaty, monthRangeAlmaty } from "@/lib/timezone";

export default async function PaymentsPage() {
  const supabase = createClient();
  const monthKey = currentMonthKeyAlmaty();
  const range = monthRangeAlmaty(monthKey);

  const [{ data: employees }, { data: rows }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, role, rop_id")
      .in("role", ["mop", "rop", "trainee"])
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local")
      .order("name"),
    supabase
      .from("revenue_requests")
      .select("*, users!revenue_requests_user_id_fkey(name)")
      .eq("status", "approved")
      .order("earned_at", { ascending: false, nullsFirst: false })
      .gte("earned_at", range.start)
      .lt("earned_at", range.end)
      .limit(2000),
  ]);

  // По умолчанию показываем текущий месяц по Алматы: так сразу видны итоги.
  const monthFrom = `${monthKey}-01`;
  const monthTo = almatyDayKey(new Date(new Date(range.end).getTime() - 86400000));

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

      <PaymentsClient employees={employees ?? []} initialRows={rows ?? []}
        initialFrom={monthFrom}
        initialTo={monthTo}
      />
    </div>
  );
}
