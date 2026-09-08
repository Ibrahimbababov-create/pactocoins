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
  const [{ data: mops }, { data: obBlocks }, { data: obProgress }] = await Promise.all([
    admin
      .from("users")
      .select("id, name, role, rop_id, total_earned, month_earned")
      .in("role", ["mop", "trainee"])
      .eq("is_active", true)
      .eq("is_guest", false)
      .not("email", "like", "%.test@pactocoins.local")
      .order("name"),
    admin
      .from("onboarding_blocks")
      .select("id, day, required, kind")
      .neq("kind", "test"),
    admin.from("onboarding_progress").select("user_id, block_id"),
  ]);

  const dayOfBlock = Object.fromEntries((obBlocks ?? []).map((b) => [b.id, b.day]));
  const totalByDay = { 1: 0, 2: 0, 3: 0 };
  for (const b of obBlocks ?? []) if (b.required) totalByDay[b.day]++;

  const progressByUser = {};
  for (const p of obProgress ?? []) {
    const day = dayOfBlock[p.block_id];
    if (!day) continue;
    ((progressByUser[p.user_id] ||= { 1: 0, 2: 0, 3: 0 })[day])++;
  }

  const withProgress = (m) => ({
    ...m,
    onboarding:
      m.role === "trainee"
        ? { done: progressByUser[m.id] ?? { 1: 0, 2: 0, 3: 0 }, total: totalByDay }
        : null,
  });

  const mine = (mops ?? []).filter((m) => m.rop_id === profile.id).map(withProgress);
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
