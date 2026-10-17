import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getLiveData } from "@/lib/tournamentLive";
import TournamentLive from "@/components/TournamentLive";

export const dynamic = "force-dynamic";

// Тот же живой экран, что на телевизоре, для всех сотрудников.
export default async function TournamentLivePage({ params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const { data: viewer } = await admin.from("users").select("id, role").eq("id", user.id).single();
  const data = await getLiveData(admin, params.id, viewer);
  if (!data) notFound();
  return (
    <TournamentLive
      initial={data}
      viewerId={viewer.id}
      apiUrl={`/api/tournaments/${params.id}/live`}
      backHref={`/mop/games/tournament/${params.id}`}
    />
  );
}
