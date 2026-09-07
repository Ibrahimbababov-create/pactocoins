import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import OnboardingItemsEditor from "@/components/OnboardingItemsEditor";

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
  const { data: items } = await admin
    .from("onboarding_items")
    .select("*")
    .eq("rop_id", profile.id)
    .eq("is_shared", false)
    .order("day")
    .order("sort");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Материалы стажёрам</h1>
        <p className="text-sm text-gray-500 mt-1">
          То, что видят только твои стажёры вдобавок к общим материалам:
          инфа о продукте, запись вебинара, пробные уроки, КП (День 1),
          записи успешных звонков, скрипт отдела, Telegram-группа материалов
          (День 2).
        </p>
      </div>
      <OnboardingItemsEditor scope="rop" items={items ?? []} />
    </div>
  );
}
