import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import Link from "next/link";
import { redirect } from "next/navigation";
import OnboardingRopEditor from "@/components/OnboardingRopEditor";

export const dynamic = "force-dynamic";

export default async function RopOnboardingMaterialsPage({ searchParams }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, project_id")
    .eq("id", user.id)
    .single();

  const canEditAll = profile?.role === "admin" || profile?.role === "mentor";
  if (!canEditAll && profile?.role !== "rop") redirect("/mop");

  const admin = createAdminClient();

  // Материалы принадлежат проекту. Админ и наставник правят любой,
  // РОП — только те, за которыми закреплён.
  const { data: allProjects } = await admin
    .from("projects")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  let projects = allProjects ?? [];
  if (!canEditAll) {
    const { data: mine } = await admin
      .from("project_rops")
      .select("project_id")
      .eq("rop_id", profile.id);
    const ids = new Set([
      ...(mine ?? []).map((m) => m.project_id),
      profile.project_id,
    ].filter(Boolean));
    projects = projects.filter((p) => ids.has(p.id));
  }

  const projectId =
    projects.find((p) => p.id === searchParams?.project)?.id ??
    projects[0]?.id ??
    null;
  const [{ data: blocks }, { data: ropBlocks }, { data: links }] = await Promise.all([
    admin
      .from("onboarding_blocks")
      .select("*")
      .eq("owner", "rop")
      .order("day")
      .order("sort"),
    projectId
      ? admin.from("onboarding_rop_blocks").select("*").eq("project_id", projectId)
      : Promise.resolve({ data: [] }),
    projectId
      ? admin.from("onboarding_links").select("*").eq("project_id", projectId).order("sort")
      : Promise.resolve({ data: [] }),
  ]);

  const ropByBlock = Object.fromEntries((ropBlocks ?? []).map((r) => [r.block_id, r]));
  const linksByBlock = {};
  for (const l of links ?? []) {
    (linksByBlock[l.block_id] ||= []).push({
      id: l.id,
      title: l.title,
      url: l.url,
      note: l.note,
    });
  }

  const enriched = (blocks ?? []).map((b) => ({
    id: b.id,
    day: b.day,
    title: b.title,
    subtitle: b.subtitle,
    kind: b.kind,
    defaultBody: b.body_md,
    rop: ropByBlock[b.id]
      ? {
          source: ropByBlock[b.id].source,
          telegraph_url: ropByBlock[b.id].telegraph_url,
          body_md: ropByBlock[b.id].body_md,
        }
      : null,
    links: linksByBlock[b.id] ?? [],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Материалы стажёрам</h1>
        <p className="text-sm text-gray-500 mt-1">
          Блоки проекта: график, мотивация/дисциплина, регламент CRM,
          вебинар, КП, договор, записи звонков, скрипт, рабочие чаты. Статьи можно
          писать текстом или вставить ссылку на telegra.ph.
        </p>
      </div>
      {projects.length === 0 ? (
        <p className="text-sm text-gray-500">
          За тобой пока не закреплён ни один проект. Попроси Ибрагима добавить
          тебя в проект, и здесь появятся его материалы.
        </p>
      ) : (
        <>
          {projects.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/mop/onboarding-materials?project=${p.id}`}
                  className={`rounded-xl px-3 py-1.5 text-sm border transition ${
                    p.id === projectId
                      ? "bg-acid-400/15 border-acid-400 text-acid-400 font-semibold"
                      : "border-dark-600 text-gray-400"
                  }`}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          )}
          <OnboardingRopEditor blocks={enriched} projectId={projectId} />
        </>
      )}
    </div>
  );
}
