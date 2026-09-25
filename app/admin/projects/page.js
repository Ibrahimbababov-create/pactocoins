import { createClient } from "@/lib/supabase-server";
import ProjectsClient from "@/components/ProjectsClient";

export default async function ProjectsPage() {
  const supabase = createClient();

  const [{ data: projects }, { data: links }, { data: people }] = await Promise.all([
    supabase.from("projects").select("*").order("is_active", { ascending: false }).order("name"),
    supabase.from("project_rops").select("project_id, rop_id"),
    supabase
      .from("users")
      .select("id, name, role, project_id, is_active")
      .eq("is_guest", false)
      .eq("is_active", true)
      .not("email", "like", "%.test@pactocoins.local")
      .order("name"),
  ]);

  const rops = (people ?? []).filter((u) => u.role === "rop");
  const ropById = Object.fromEntries(rops.map((r) => [r.id, r]));

  const withRops = (projects ?? []).map((p) => ({
    ...p,
    rops: (links ?? [])
      .filter((l) => l.project_id === p.id)
      .map((l) => ropById[l.rop_id])
      .filter(Boolean),
  }));

  const peopleByProject = {};
  for (const u of people ?? []) {
    if (!u.project_id) continue;
    (peopleByProject[u.project_id] ||= []).push(u);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold">Проекты</h1>
        <p className="text-sm text-gray-500 mt-1">
          У РОПа проектов может быть несколько. Менеджер закреплён за одним —
          проект выбирается в карточке сотрудника.
        </p>
      </div>

      <ProjectsClient
        projects={withRops}
        rops={rops}
        peopleByProject={peopleByProject}
        people={people ?? []}
      />
    </div>
  );
}
