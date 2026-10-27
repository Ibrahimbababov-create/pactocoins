import { createClient } from "@/lib/supabase-server";
import PaymentsClient from "@/components/PaymentsClient";
import { almatyDayKey, currentMonthKeyAlmaty, monthRangeAlmaty } from "@/lib/timezone";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function PaymentsPage({ searchParams = {} }) {
  const supabase = createClient();
  const monthKey = currentMonthKeyAlmaty();
  const range = monthRangeAlmaty(monthKey);

  // Выбор людей живёт в адресе: ?u=id1,id2 (старый ?userId=… тоже понимаем).
  const rawIds = [searchParams.u, searchParams.userId]
    .flat()
    .filter(Boolean)
    .join(",")
    .split(",")
    .map((x) => x.trim());
  const selectedIds = [...new Set(rawIds.filter((x) => UUID_RE.test(x)))].slice(0, 100);
  const urlFrom = DAY_RE.test(String(searchParams.from ?? "")) ? searchParams.from : null;
  const urlTo = DAY_RE.test(String(searchParams.to ?? "")) ? searchParams.to : null;

  let rowsQuery = supabase
    .from("revenue_requests")
    .select("*, users!revenue_requests_user_id_fkey(name)")
    .eq("status", "approved")
    .order("earned_at", { ascending: false, nullsFirst: false })
    .gte("earned_at", urlFrom ? new Date(`${urlFrom}T00:00:00+05:00`).toISOString() : range.start)
    .lt("earned_at", urlTo ? new Date(`${urlTo}T23:59:59+05:00`).toISOString() : range.end)
    .limit(2000);
  if (selectedIds.length) rowsQuery = rowsQuery.in("user_id", selectedIds);

  const [{ data: employees }, { data: rows }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, role, rop_id, is_active")
      .in("role", ["mop", "rop", "trainee"])
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local")
      .order("name"),
    rowsQuery,
  ]);

  // По умолчанию показываем текущий месяц по Алматы: так сразу видны итоги.
  const monthFrom = `${monthKey}-01`;
  const monthTo = almatyDayKey(new Date(new Date(range.end).getTime() - 86400000));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold">Сверка оплат</h1>
        <p className="text-sm text-gray-500 mt-1">
          Выберите период и людей, сравните суммы с таблицей зарплат. Если оплата
          записана неверно, её можно изменить или отменить: коины пересчитаются,
          сотруднику уйдёт сообщение.
        </p>
      </div>

      <PaymentsClient employees={employees ?? []} initialRows={rows ?? []}
        initialFrom={urlFrom ?? monthFrom}
        initialTo={urlTo ?? monthTo}
        initialUserIds={selectedIds}
      />
    </div>
  );
}
