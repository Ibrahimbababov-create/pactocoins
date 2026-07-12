import { createClient } from "@/lib/supabase-server";
import RewardsAdminClient from "@/components/RewardsAdminClient";
import CategoriesManager from "@/components/CategoriesManager";

export default async function RewardsAdminPage() {
  const supabase = createClient();

  const { data: categories } = await supabase
    .from("reward_categories")
    .select("*")
    .order("sort_order")
    .order("name");

  const { data: rewards } = await supabase
    .from("rewards")
    .select("*")
    .order("sort_order")
    .order("price_coins");

  const categoryOrder = {};
  categories?.forEach((c, i) => {
    categoryOrder[c.name] = i;
  });

  const sortedRewards = [...(rewards ?? [])].sort((a, b) => {
    const orderA = categoryOrder[a.category] ?? 999;
    const orderB = categoryOrder[b.category] ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.price_coins - b.price_coins;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Магазин наград</h1>
      <CategoriesManager categories={categories ?? []} />
      <RewardsAdminClient
        rewards={sortedRewards}
        categories={categories ?? []}
      />
    </div>
  );
}
