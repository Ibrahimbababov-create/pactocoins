import { createClient } from "@/lib/supabase-server";
import ShopClient from "@/components/ShopClient";

export default async function ShopPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("balance")
    .eq("id", user.id)
    .single();

  const { data: rewards } = await supabase
    .from("rewards")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("price_coins");

  const grouped = {};
  rewards?.forEach((r) => {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Магазин наград</h1>
        <div className="text-right">
          <p className="text-xs text-gray-500">Баланс</p>
          <p className="text-xl font-black text-acid-400">
            {profile?.balance ?? 0}
          </p>
        </div>
      </div>

      <ShopClient grouped={grouped} balance={profile?.balance ?? 0} />
    </div>
  );
}
