import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getTournamentPage } from "@/lib/tournamentView";
import { sweepTournaments } from "@/lib/tournament";
import AdminTournamentClient from "@/components/AdminTournamentClient";

export const dynamic = "force-dynamic";

export default async function AdminTournamentPage({ params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();
  await sweepTournaments(admin, { tournamentId: params.id });
  const data = await getTournamentPage(admin, params.id, { id: user.id, role: "admin" });
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/tournaments" className="text-sm text-gray-400">
          ‹ Турниры
        </Link>
        <h1 className="text-2xl font-display font-bold mt-1">{data.tournament.title}</h1>
        <Link href={`/mop/games/tournament/${params.id}`} className="text-xs text-acid-400">
          Как видят участники
        </Link>
      </div>
      <AdminTournamentClient data={data} now={Date.now()} />
    </div>
  );
}
