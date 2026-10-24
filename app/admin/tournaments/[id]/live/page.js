import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getLiveData } from "@/lib/tournamentLive";
import TournamentLive from "@/components/TournamentLive";

export const dynamic = "force-dynamic";

// «Наблюдать за игрой» из админки: открыть на ноутбуке, вывести на телевизор.
export default async function AdminTournamentLivePage({ params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const data = await getLiveData(createAdminClient(), params.id, { id: user.id, role: "admin" });
  if (!data) notFound();
  return (
    <TournamentLive
      initial={data}
      apiUrl={`/api/tournaments/${params.id}/live`}
      backHref={`/admin/tournaments/${params.id}`}
    />
  );
}
