import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import TeamManageClient from "@/components/TeamManageClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "rop" && profile?.role !== "admin") {
    redirect("/mop");
  }

  const admin = createAdminClient();
  const { data: mops } = await admin
    .from("users")
    .select(
      "id, name, role, rop_id, total_earned, month_earned, onboarding_day1_done, onboarding_day2_done, onboarding_day3_done"
    )
    .in("role", ["mop", "trainee"])
    .eq("is_active", true)
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local")
    .order("name");

  const mine = (mops ?? []).filter((m) => m.rop_id === profile.id);
  // РОП может добавить только свободного МОПа. Админ — любого.
  const others = (mops ?? []).filter((m) =>
    profile.role === "admin" ? m.rop_id !== profile.id : !m.rop_id
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Моя команда</h1>
      <TeamManageClient mine={mine} others={others} />
    </div>
  );
}
