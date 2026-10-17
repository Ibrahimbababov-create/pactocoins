import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getTournamentPage } from "@/lib/tournamentView";
import { sweepTournaments } from "@/lib/tournament";
import GameHeader from "@/components/GameHeader";
import TournamentClient from "@/components/TournamentClient";

export const dynamic = "force-dynamic";

export default async function TournamentPage({ params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: viewer } = await admin
    .from("users")
    .select("id, role, is_guest, balance, clash_tag")
    .eq("id", user.id)
    .single();

  // Просроченные подтверждения засчитываем при открытии — не ждём крон.
  await sweepTournaments(admin, { tournamentId: params.id });

  const data = await getTournamentPage(admin, params.id, viewer);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <GameHeader title={data.tournament.title} />
      <TournamentClient
        data={data}
        viewer={{
          id: viewer.id,
          isGuest: Boolean(viewer.is_guest),
          balance: viewer.balance ?? 0,
          clashTag: viewer.clash_tag ?? "",
        }}
      />
    </div>
  );
}
