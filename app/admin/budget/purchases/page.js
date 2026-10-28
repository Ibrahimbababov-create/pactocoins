import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { currentMonthKeyAlmaty, monthRangeAlmaty, recentMonthKeysAlmaty } from "@/lib/timezone";
import { fetchMonthPurchases } from "@/lib/purchasesMoney";
import PurchasesMoneyClient from "@/components/PurchasesMoneyClient";

export default async function PurchasesMoneyPage({ searchParams = {} }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/admin");

  const months = recentMonthKeysAlmaty(12);
  const asked = String(searchParams.month ?? "");
  const monthKey = months.some((m) => m.key === asked) ? asked : currentMonthKeyAlmaty();

  const rows = await fetchMonthPurchases(createAdminClient(), monthRangeAlmaty(monthKey));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Покупки · деньги</h1>
        <p className="text-sm text-gray-500 mt-1">
          Сколько реально потрачено на награды. Очередь заявок по-прежнему в
          «Заявки → Покупки».
        </p>
      </div>
      <PurchasesMoneyClient months={months} monthKey={monthKey} rows={rows} />
    </div>
  );
}
