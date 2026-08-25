import { createClient } from "@/lib/supabase-server";
import ShopClient from "@/components/ShopClient";

export default async function ObserverShop() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("balance")
    .eq("id", user.id)
    .single();

  const { data: categories } = await supabase
    .from("reward_categories")
    .select("*")
    .order("sort_order")
    .order("name");

  const { data: rewards } = await supabase
    .from("rewards")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("price_coins");

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
      <ShopClient grouped={grouped} balance={profile?.balance ?? 0} />
    </div>
  );
}
