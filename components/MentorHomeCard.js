import Link from "next/link";
import Icon from "@/components/Icon";
import { plural } from "@/lib/plural";

// Сводка наставника на главной: сколько стажёров учится, кто на каком дне
// и кто уже прошёл всё обучение и ждёт допуска.
export default async function MentorHomeCard({ admin, mentorId }) {
  const [{ data: trainees }, { data: blocks }, { data: progress }] = await Promise.all([
    admin
      .from("users")
      .select("id, name")
      .eq("mentor_id", mentorId)
      .eq("role", "trainee")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    admin.from("onboarding_blocks").select("id, day").eq("required", true),
    admin.from("onboarding_progress").select("user_id, block_id"),
  ]);

  const list = trainees ?? [];
  if (list.length === 0) {
    return (
      <Link
        href="/mop/trainees"
        className="flex items-center gap-3 bg-dark-800 border border-dark-600 rounded-2xl p-4"
      >
        <Icon name="users" className="w-8 h-8 text-gray-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Стажёров пока нет</p>
          <p className="text-sm text-gray-400 mt-0.5">
            Как только закрепят новичка, здесь будет, на каком он дне
          </p>
        </div>
        <Icon name="chevronRight" className="w-5 h-5 text-gray-600 shrink-0" />
      </Link>
    );
  }

  const dayOfBlock = Object.fromEntries((blocks ?? []).map((b) => [b.id, b.day]));
  const totalByDay = {};
  for (const b of blocks ?? []) totalByDay[b.day] = (totalByDay[b.day] ?? 0) + 1;
  const days = Object.keys(totalByDay).map(Number).sort((a, b) => a - b);

  const ids = new Set(list.map((t) => t.id));
  const doneByUser = {};
  for (const p of progress ?? []) {
    if (!ids.has(p.user_id)) continue;
    const d = dayOfBlock[p.block_id];
    if (!d) continue;
    ((doneByUser[p.user_id] ||= {})[d] = (doneByUser[p.user_id][d] ?? 0) + 1);
  }

  const rows = list.map((t) => {
    const done = doneByUser[t.id] ?? {};
    const finished = days.filter((d) => (done[d] ?? 0) >= totalByDay[d]).length;
    const ready = days.length > 0 && finished === days.length;
    return { ...t, finished, ready };
  });
  const ready = rows.filter((r) => r.ready).length;

  return (
    <Link
      href="/mop/trainees"
      className="block bg-dark-800 border border-dark-600 rounded-2xl p-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Твои стажёры</p>
        <Icon name="chevronRight" className="w-4 h-4 text-gray-600" />
      </div>
      <p className="font-display text-3xl font-bold tabular-nums mt-1">
        {rows.length}{" "}
        <span className="text-base font-sans font-normal text-gray-400">
          {plural(rows.length, "учится", "учатся", "учатся")}
        </span>
      </p>
      <div className="mt-3 space-y-2.5">
        {rows.slice(0, 4).map((r) => (
          <div key={r.id}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{r.name}</span>
              <span className={`shrink-0 text-xs ${r.ready ? "text-acid-400 font-semibold" : "text-gray-500"}`}>
                {r.ready ? "готов к допуску" : `дней пройдено: ${r.finished} из ${days.length}`}
              </span>
            </div>
            <div className="flex gap-1 mt-1.5">
              {days.map((d, i) => (
                <div
                  key={d}
                  className={`h-1 flex-1 rounded-full ${i < r.finished ? "bg-acid-400" : "bg-dark-600"}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {rows.length > 4 && (
        <p className="text-xs text-gray-500 mt-2">и ещё {rows.length - 4}</p>
      )}
      {ready > 0 && (
        <p className="text-xs text-acid-400 mt-3">
          Готовы к допуску: {ready}. Загляни и допусти.
        </p>
      )}
    </Link>
  );
}
