import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getTournamentPage } from "@/lib/tournamentView";
import { sweepTournaments } from "@/lib/tournament";
import AdminTournamentClient from "@/components/AdminTournamentClient";
import Icon from "@/components/Icon";

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
          Страница игрока: как видят участники, здесь же можно записаться самому
        </Link>
      </div>
      {/* Живой экран для телевизора в офисе */}
      <Link
        href={`/admin/tournaments/${params.id}/live`}
        className="flex items-center gap-3 rounded-2xl border border-acid-400/40 bg-gradient-to-br from-acid-400/15 to-dark-800 p-4 active:opacity-80"
      >
        <span className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-acid-400 text-black">
          <Icon name="eye" className="w-6 h-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Наблюдать за игрой</span>
          <span className="block text-xs text-gray-400">
            Таблица, туры и кто когда нажал, обновляется сама. Открой и выведи на телевизор.
          </span>
        </span>
        <Icon name="chevronRight" className="w-4 h-4 shrink-0 text-gray-600" />
      </Link>
      <AdminTournamentClient data={data} now={Date.now()} />
    </div>
  );
}
