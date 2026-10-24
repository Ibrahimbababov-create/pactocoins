import Link from "next/link";
import { createAdminClient } from "@/lib/supabase-admin";
import { formatCoins } from "@/lib/plural";
import { formatDateTimeAlmaty } from "@/lib/timezone";
import AdminTournamentForm from "@/components/AdminTournamentForm";

export const dynamic = "force-dynamic";

const STATUS = {
  draft: "Черновик",
  registration: "Идёт запись",
  seeding: "Собираем сетку",
  running: "Идёт",
  finished: "Завершён",
  cancelled: "Отменён",
};

export default async function AdminTournamentsPage() {
  const admin = createAdminClient();
  const [{ data: list }, { data: entries }] = await Promise.all([
    admin.from("tournaments").select("*").order("created_at", { ascending: false }).limit(30),
    admin.from("tournament_entries").select("tournament_id, paid_coins, status").neq("status", "refunded"),
  ]);
  const shown = (list ?? []).filter((t) => !t.hidden_at);
  const hidden = (list ?? []).filter((t) => t.hidden_at);
  const stats = {};
  for (const e of entries ?? []) {
    const s = (stats[e.tournament_id] ||= { players: 0, paid: 0 });
    s.players++;
    s.paid += e.paid_coins || 0;
  }
  const row = (t) => <TournamentRow key={t.id} t={t} s={stats[t.id] ?? { players: 0, paid: 0 }} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold">Турниры</h1>
        <p className="text-sm text-gray-500 mt-1">
          Взносы идут в общий банк, победитель финала забирает всё. Для Pacto это стоит только добавку сверху.
        </p>
      </div>

      {shown.length > 0 && <div className="space-y-2">{shown.map(row)}</div>}

      {hidden.length > 0 && (
        <details className="space-y-2">
          <summary className="text-sm text-gray-500 cursor-pointer px-1">Скрытые · {hidden.length}</summary>
          <div className="space-y-2 pt-2 opacity-70">{hidden.map(row)}</div>
        </details>
      )}

      <AdminTournamentForm />
    </div>
  );
}

// Строка списка: название, статус, игроки, банк.
function TournamentRow({ t, s }) {
  return (
    <Link
      href={`/admin/tournaments/${t.id}`}
      className="block bg-dark-800 border border-dark-600 rounded-2xl p-4 active:bg-dark-700"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold truncate">{t.title}</p>
        <span className="shrink-0 text-xs text-gray-400">
          {STATUS[t.status]}
          {t.is_test ? " · тест" : ""}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Игроков {s.players} · банк {formatCoins(t.pot_coins ?? s.paid + (t.bonus_coins || 0))} · создан{" "}
        {formatDateTimeAlmaty(t.created_at)}
      </p>
    </Link>
  );
}
