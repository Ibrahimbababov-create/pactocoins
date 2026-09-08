import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import OnboardingRopEditor from "@/components/OnboardingRopEditor";

export const dynamic = "force-dynamic";

export default async function RopOnboardingMaterialsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "rop" && profile?.role !== "admin") {
    redirect("/mop");
  }

  const admin = createAdminClient();
  const [{ data: blocks }, { data: ropBlocks }, { data: links }] = await Promise.all([
    admin
      .from("onboarding_blocks")
      .select("*")
      .eq("owner", "rop")
      .order("day")
      .order("sort"),
    admin.from("onboarding_rop_blocks").select("*").eq("rop_id", profile.id),
    admin.from("onboarding_links").select("*").eq("rop_id", profile.id).order("sort"),
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
          Блоки под твой проект: график, мотивация/дисциплина, регламент CRM,
          вебинар, КП, договор, записи звонков, скрипт, рабочие чаты. Статьи можно
          писать текстом или вставить ссылку на telegra.ph.
        </p>
      </div>
      <OnboardingRopEditor blocks={enriched} />
    </div>
  );
}
