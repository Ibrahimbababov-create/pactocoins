import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getOnboardingLibrary } from "@/lib/onboarding";
import OnboardingLibraryClient from "@/components/OnboardingLibraryClient";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("role, rop_id, project_id")
    .eq("id", user.id)
    .single();

  // Материалы показываем по проекту: у менеджера и стажёра один и тот же
  // набор, если они в одном направлении. У админа проекта нет — чтобы он
  // видел не пустой экран, берём первый проект.
  let projectId = profile?.project_id ?? null;
  if (!projectId && profile?.role === "admin") {
    const { data: anyProject } = await supabase
      .from("projects")
      .select("id")
      .eq("is_active", true)
      .order("name")
      .limit(1)
      .maybeSingle();
    projectId = anyProject?.id ?? null;
  }

  const blocks = await getOnboardingLibrary(createAdminClient(), projectId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Регламенты и обучение</h1>
        <p className="text-sm text-gray-500 mt-1">
          Всё, что добавили админ и твой РОП — можно пересмотреть в любой момент.
        </p>
      </div>
      <OnboardingLibraryClient blocks={blocks} />
    </div>
  );
}
