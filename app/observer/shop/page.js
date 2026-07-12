import { createClient } from "@/lib/supabase-server";

const GLOW_STYLES = {
  gold: "0 0 24px rgba(250, 204, 21, 0.55)",
  purple: "0 0 24px rgba(168, 85, 247, 0.55)",
  cyan: "0 0 24px rgba(34, 211, 238, 0.55)",
  red: "0 0 24px rgba(248, 113, 113, 0.55)",
};

const GLOW_BORDERS = {
  gold: "border-yellow-400",
  purple: "border-purple-400",
  cyan: "border-cyan-400",
  red: "border-red-400",
};

export default async function ObserverShop() {
  const supabase = createClient();

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
  Object.keys(grouped).forEach((key) => {
    if (grouped[key].length === 0) delete grouped[key];
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Магазин наград</h1>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="space-y-3">
          <p className="text-sm text-gray-500">{category}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {items.map((reward) => (
              <div
                key={reward.id}
                className={`bg-dark-800 border rounded-2xl p-4 ${
                  reward.highlight_color
                    ? GLOW_BORDERS[reward.highlight_color]
                    : "border-dark-600"
                }`}
                style={
                  reward.highlight_color
                    ? { boxShadow: GLOW_STYLES[reward.highlight_color] }
                    : undefined
                }
              >
                <p className="font-semibold text-sm leading-tight">
                  {reward.title}
                </p>
                {reward.description && (
                  <p className="text-xs text-gray-500 mt-1">
                    {reward.description}
                  </p>
                )}
                <p className="text-acid-400 font-bold mt-3">
                  {reward.price_coins} coins
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
