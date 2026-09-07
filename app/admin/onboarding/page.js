import { createAdminClient } from "@/lib/supabase-admin";
import OnboardingItemsEditor from "@/components/OnboardingItemsEditor";

export const dynamic = "force-dynamic";

export default async function AdminOnboardingPage() {
  const admin = createAdminClient();
  const { data: items } = await admin
    .from("onboarding_items")
    .select("*")
    .eq("is_shared", true)
    .order("day")
    .order("sort");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Обучение новичков</h1>
        <p className="text-sm text-gray-500 mt-1">
          Общие материалы для всех стажёров — глоссарий, регламент, видеокурс,
          инструкция по CRM. Материалы по продукту и записи звонков каждый РОП
          добавляет сам на своей странице «Материалы стажёрам».
        </p>
      </div>
      <OnboardingItemsEditor scope="shared" items={items ?? []} />
    </div>
  );
}
