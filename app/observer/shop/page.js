import { createClient } from "@/lib/supabase-server";
import ShopClient from "@/components/ShopClient";
import { groupRewards, loadFavoriteIds } from "@/lib/shopGrouping";

export default async function ObserverShop() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: categories }, { data: rewards }, { data: variants }] =
    await Promise.all([
      supabase.from("users").select("balance, is_guest").eq("id", user.id).single(),
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
      supabase.from("reward_variants").select("*").order("sort_order"),
    ]);

  const variantsByReward = {};
  variants?.forEach((v) => {
    (variantsByReward[v.reward_id] ||= []).push(v);
  });

  const grouped = groupRewards(categories, rewards, variantsByReward);
  const favoriteIds = await loadFavoriteIds(supabase, user.id);

  return (
    <div className="space-y-6">
      <ShopClient
        grouped={grouped}
        balance={profile?.balance ?? 0}
        favoriteIds={favoriteIds}
        isGuest={!!profile?.is_guest}
      />
    </div>
  );
}
