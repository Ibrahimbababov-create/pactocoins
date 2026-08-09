import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import Link from "next/link";
import FundsClient from "@/components/FundsClient";

export default async function FundsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("balance, role")
    .eq("id", user.id)
    .single();

  const homeHref =
    profile?.role === "admin"
      ? "/admin"
      : profile?.role === "observer"
      ? "/observer"
      : "/mop";

  // Список копилок и то, кто сколько внёс, должно быть видно всем
  // (прозрачность) — RLS на users не даёт обычному МОПу читать имена
  // других людей напрямую, поэтому эту часть читаем admin-клиентом.
  const admin = createAdminClient();

  const { data: funds } = await admin
    .from("funds")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const fundIds = (funds ?? []).map((f) => f.id);

  const { data: contributions } = fundIds.length
    ? await admin
        .from("fund_contributions")
        .select("*, users(name)")
        .in("fund_id", fundIds)
    : { data: [] };

  return (
    <div className="space-y-6">
      <Link href={homeHref} className="text-gray-500 text-sm">
        ← На главную
      </Link>
      <h1 className="text-2xl font-bold">🐷 Копилки</h1>
      <FundsClient
        funds={funds ?? []}
        contributions={contributions ?? []}
        balance={profile?.balance ?? 0}
      />
    </div>
  );
}
