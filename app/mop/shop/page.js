import { createClient } from "@/lib/supabase-server";
import ShopClient from "@/components/ShopClient";

export default async function ShopPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: categories }, { data: rewards }] =
    await Promise.all([
      supabase.from("users").select("balance").eq("id", user.id).single(),
      supabase
        .from("reward_categories")
        .select("*")
        .order("sort_order")
        .order("name"),
      supabase
        .from("rewards")
        .select("*")
        .eq("is_active", true)
        .order("sort_order")
        .order("price_coins"),
    ]);

  const grouped = {};
  categories?.forEach((c) => {
    grouped[c.name] = [];
  });

  rewards?.forEach((r) => {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  });

  // Убираем пустые категории из отображения
  Object.keys(grouped).forEach((key) => {
    if (grouped[key].length === 0) delete grouped[key];
  });

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-amber-500/10 to-dark-800 border border-amber-500/30 rounded-2xl p-4">
        <p className="font-bold text-amber-300">🎁 Скоро: сундуки</p>
        <p className="text-sm text-gray-400 mt-1">
          Купил сундук за коины — открыл и получил случайный приз. Готовим,
          следите за магазином.
        </p>
      </div>

      <ShopClient grouped={grouped} balance={profile?.balance ?? 0} />
    </div>
  );
}
