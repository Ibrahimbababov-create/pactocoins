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
    .select("role, rop_id")
    .eq("id", user.id)
    .single();

  const ropId = profile?.role === "rop" ? user.id : profile?.rop_id ?? null;
  const blocks = await getOnboardingLibrary(createAdminClient(), ropId);

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
