import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import TeamManageClient from "@/components/TeamManageClient";
import { getTeamOverview } from "@/lib/teamStats";
import { effectiveUserId } from "@/lib/viewAs";

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

  // Своей команды у админа нет, поэтому «Моя команда» у него пустая. Если
  // он смотрит глазами РОПа — показываем команду того РОПа.
  const ownerId = effectiveUserId(profile?.role, profile.id);
  const watching = ownerId !== profile.id;

  const admin = createAdminClient();
  const [overview, { data: free }, { data: obBlocks }, { data: obProgress }] = await Promise.all([
    getTeamOverview(admin, ownerId),
    // Кого можно добавить: РОПу — только свободных МОПов, админу — любого.
    watching
      ? Promise.resolve({ data: [] })
      : admin
          .from("users")
          .select("id, name, role, rop_id")
          .in("role", ["mop", "trainee"])
          .eq("is_active", true)
          .eq("is_guest", false)
          .not("email", "like", "%.test@pactocoins.local")
          .order("name"),
    admin
      .from("onboarding_blocks")
      .select("id, day, required, kind")
      .in("kind", ["article", "test"]),
    admin.from("onboarding_progress").select("user_id, block_id"),
  ]);

  // Пройденными считаем только обязательные блоки: те же, что в «всего».
  const dayOfBlock = Object.fromEntries(
    (obBlocks ?? []).filter((b) => b.required).map((b) => [b.id, b.day])
  );
  const totalByDay = { 1: 0, 2: 0, 3: 0 };
  for (const b of obBlocks ?? []) if (b.required) totalByDay[b.day]++;

  const traineeIds = new Set(overview.people.filter((m) => m.role === "trainee").map((m) => m.id));
  const progressByUser = {};
  for (const p of obProgress ?? []) {
    if (!traineeIds.has(p.user_id)) continue;
    const day = dayOfBlock[p.block_id];
    if (!day) continue;
    ((progressByUser[p.user_id] ||= { 1: 0, 2: 0, 3: 0 })[day])++;
  }
  const onboarding = Object.fromEntries(
    [...traineeIds].map((id) => [
      id,
      { done: progressByUser[id] ?? { 1: 0, 2: 0, 3: 0 }, total: totalByDay },
    ])
  );

  const others = (free ?? []).filter((m) =>
    profile.role === "admin" ? m.rop_id !== profile.id : !m.rop_id
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Моя команда</h1>
      <TeamManageClient
        overview={overview}
        others={others}
        watching={watching}
        onboarding={onboarding}
      />
    </div>
  );
}
