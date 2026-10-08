import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { DEPARTMENTS, departmentForProject } from "@/lib/sales/departments";

// Кто какой отдел видит:
//  • админ и наблюдатель — все отделы, со списком оплат;
//  • РОП — отделы своих проектов (project_rops) и своего проекта, со списком оплат;
//  • остальные — только отдел своего проекта, без списка оплат (там клиенты);
//  • гость — ничего.
// Проекты и связи читаем сервисным клиентом: у сотрудника нет прав на
// чтение project_rops, а пользователь уже проверен через auth.getUser().
export async function getSalesAccess() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { departments: [], lead: false };

  const { data: me } = await supabase
    .from("users")
    .select("id, name, role, project_id, is_guest, is_active")
    .eq("id", user.id)
    .single();
  // стажёр ещё учится — аналитика отдела ему пока ни к чему
  if (!me || me.is_guest || me.is_active === false || me.role === "trainee")
    return { departments: [], lead: false };

  if (me.role === "admin" || me.role === "observer") {
    return { me, departments: DEPARTMENTS, lead: true, all: true };
  }

  const admin = createAdminClient();
  const [{ data: projects }, { data: links }] = await Promise.all([
    admin.from("projects").select("id, name"),
    me.role === "rop"
      ? admin.from("project_rops").select("project_id").eq("rop_id", me.id)
      : Promise.resolve({ data: [] }),
  ]);
  const nameOf = Object.fromEntries((projects ?? []).map((p) => [p.id, p.name]));
  const projectIds = new Set([me.project_id, ...(links ?? []).map((l) => l.project_id)].filter(Boolean));

  const ids = new Set();
  projectIds.forEach((pid) => {
    const d = departmentForProject(nameOf[pid]);
    if (d) ids.add(d.id);
  });
  const departments = DEPARTMENTS.filter((d) => ids.has(d.id));
  return { me, departments, lead: me.role === "rop", all: false };
}
