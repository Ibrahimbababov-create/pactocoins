import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import RevenueEditsClient from "@/components/RevenueEditsClient";
import { driftedFields, editSnapshot } from "@/lib/revenueEdits";

export const dynamic = "force-dynamic";

export default async function RevenueEditsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/admin");

  const admin = createAdminClient();

  const [{ data: pending, error }, { data: recent }] = await Promise.all([
    admin
      .from("revenue_edit_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(200),
    admin
      .from("revenue_edit_requests")
      .select("*")
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .limit(20),
  ]);

  const header = (
    <div>
      <h1 className="text-2xl font-display font-bold">Исправления оплат</h1>
      <p className="text-sm text-gray-500 mt-1">
        Сотрудники нашли ошибку в своей оплате и предлагают исправить. Оплата меняется только
        после «Применить»: коины пересчитаются, правка попадёт в журнал оплат.
      </p>
    </div>
  );

  if (error) {
    return (
      <div className="space-y-4">
        {header}
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 text-sm text-gray-400">
          Раздел ещё не включён.
        </div>
      </div>
    );
  }

  const all = [...(pending ?? []), ...(recent ?? [])];
  const userIds = [...new Set(all.map((e) => e.user_id))];
  const requestIds = [...new Set(all.map((e) => e.request_id))];

  const [{ data: people }, { data: payments }] = await Promise.all([
    userIds.length
      ? admin.from("users").select("id, name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    requestIds.length
      ? admin
          .from("revenue_requests")
          .select("id, status, amount_kzt, earned_at, created_at, client_name, product_kind, pay_kind, is_final_part")
          .in("id", requestIds)
      : Promise.resolve({ data: [] }),
  ]);

  const names = new Map((people ?? []).map((p) => [p.id, p.name]));
  const payById = new Map((payments ?? []).map((p) => [p.id, p]));

  const shape = (e) => {
    const pay = payById.get(e.request_id) ?? null;
    const current = pay ? editSnapshot(pay) : null;
    return {
      id: e.id,
      status: e.status,
      userName: names.get(e.user_id) ?? "сотрудник удалён",
      proposed: e.proposed ?? {},
      original: e.original ?? null,
      reason: e.reason,
      adminComment: e.admin_comment,
      createdAt: e.created_at,
      reviewedAt: e.reviewed_at,
      paymentStatus: pay?.status ?? null,
      current,
      drift: current ? driftedFields(e.original, current, Object.keys(e.proposed ?? {})) : [],
    };
  };

  return (
    <div className="space-y-4">
      {header}
      <RevenueEditsClient
        pending={(pending ?? []).map(shape)}
        recent={(recent ?? []).map(shape)}
      />
    </div>
  );
}
