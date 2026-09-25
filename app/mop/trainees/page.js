import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import Icon from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import TraineeProjectPicker from "@/components/TraineeProjectPicker";

// Экран наставника: его стажёры и то, на каком они дне.
export default async function TraineesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: me },
    { data: trainees },
    { data: blocks },
    { data: progress },
    { data: projects },
  ] = await Promise.all([
      supabase.from("users").select("role").eq("id", user.id).single(),
      supabase
        .from("users")
        .select("id, name, created_at, project_id, is_active, projects(name)")
        .eq("mentor_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("onboarding_blocks")
        .select("id, day, required")
        .eq("required", true),
      supabase.from("onboarding_progress").select("user_id, block_id"),
      supabase
        .from("projects")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
    ]);

  const traineeIds = new Set((trainees ?? []).map((t) => t.id));
  const dayOfBlock = Object.fromEntries((blocks ?? []).map((b) => [b.id, b.day]));

  const totalByDay = {};
  for (const b of blocks ?? []) totalByDay[b.day] = (totalByDay[b.day] ?? 0) + 1;

  const doneByUser = {};
  for (const p of progress ?? []) {
    if (!traineeIds.has(p.user_id)) continue;
    const day = dayOfBlock[p.block_id];
    if (!day) continue;
    ((doneByUser[p.user_id] ||= {})[day] = (doneByUser[p.user_id][day] ?? 0) + 1);
  }

  const days = Object.keys(totalByDay)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold">Мои стажёры</h1>
        <p className="text-sm text-gray-500 mt-1">
          Кого ты ведёшь и кто на каком дне обучения.
        </p>
      </div>

      {(trainees ?? []).length === 0 && (
        <EmptyState
          icon="users"
          title="Стажёров пока нет"
          hint="Как только админ закрепит за тобой новичка, он появится здесь."
        />
      )}

      {(trainees ?? []).map((t) => {
        const done = doneByUser[t.id] ?? {};
        const allDone = days.every((d) => (done[d] ?? 0) >= totalByDay[d]);

        return (
          <div
            key={t.id}
            className="bg-dark-800 border border-dark-700 rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 shrink-0 rounded-full bg-acid-400/10 border border-acid-400/40 flex items-center justify-center font-display font-bold text-acid-400">
                {t.name.trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{t.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {t.projects?.name ?? "проект не выбран"}
                </p>
              </div>
              {allDone && (
                <span className="text-xs text-acid-400 font-semibold shrink-0">
                  готов к допуску
                </span>
              )}
            </div>

            <div className="flex gap-1.5">
              {days.map((d) => {
                const ok = (done[d] ?? 0) >= totalByDay[d];
                const started = (done[d] ?? 0) > 0;
                return (
                  <div key={d} className="flex-1">
                    <div
                      className={`h-1.5 rounded-full ${
                        ok ? "bg-acid-400" : started ? "bg-acid-400/40" : "bg-dark-700"
                      }`}
                    />
                    <p className="text-[10px] text-gray-600 mt-1 text-center">
                      день {d}
                    </p>
                  </div>
                );
              })}
            </div>

            <TraineeProjectPicker
              traineeId={t.id}
              projectId={t.project_id}
              projects={projects ?? []}
            />

            <Link
              href={`/messages/${t.id}`}
              className="flex items-center justify-center gap-2 text-sm text-gray-300 border border-dark-600 rounded-xl py-2.5 active:opacity-60"
            >
              <Icon name="mail" className="w-4 h-4" />
              Написать
            </Link>
          </div>
        );
      })}
    </div>
  );
}
