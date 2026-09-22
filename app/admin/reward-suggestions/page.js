import { createClient } from "@/lib/supabase-server";
import RewardSuggestionsClient from "@/components/RewardSuggestionsClient";

export const dynamic = "force-dynamic";

export default async function RewardSuggestionsPage() {
  const supabase = createClient();

  const { data: suggestions } = await supabase
    .from("reward_suggestions")
    .select("*, users!reward_suggestions_user_id_fkey(name, is_guest)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Предложения в магазин</h1>
      <RewardSuggestionsClient suggestions={suggestions ?? []} />
    </div>
  );
}
