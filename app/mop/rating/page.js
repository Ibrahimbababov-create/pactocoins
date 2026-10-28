import RatingClient from "@/components/RatingClient";
import RatingHallTabs from "@/components/RatingHallTabs";
import { getRatingData } from "@/lib/ratingData";
import { createClient } from "@/lib/supabase-server";
import { effectiveRole, resolveViewer } from "@/lib/viewAs";

const HALL_ROLES = ["mop", "rop", "mentor", "trainee"];

async function canSeeHall() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { viewId, watching } = await resolveViewer(supabase, user.id);
    const { data: profile } = await supabase
      .from("users")
      .select("role, is_guest")
      .eq("id", viewId)
      .single();
    const role = watching ? profile?.role : effectiveRole(profile?.role);
    return !profile?.is_guest && HALL_ROLES.includes(role);
  } catch {
    return false;
  }
}

export default async function RatingPage() {
  const [{ currentUserId, users, initialTotals }, showHall] = await Promise.all([
    getRatingData(),
    canSeeHall(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display font-bold">Рейтинг</h1>
      {showHall && <RatingHallTabs active="rating" />}
      <p className="text-xs text-gray-500">
        Оплаты за прошедшую неделю можно внести до 10:00 понедельника, их подтверждает админ. Оплата с датой понедельника и позже идёт уже в новую неделю.
      </p>
      <RatingClient
        currentUserId={currentUserId}
        users={users}
        initialTotals={initialTotals}
      />
    </div>
  );
}
