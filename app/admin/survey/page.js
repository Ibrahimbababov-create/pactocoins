import { createAdminClient } from "@/lib/supabase-admin";
import { getSurveyConfig, loadResponses, countDone } from "@/lib/survey";
import { SURVEY_REWARD_CHIPS } from "@/lib/surveyQuestions";
import SurveyResultsClient from "@/components/SurveyResultsClient";

export const dynamic = "force-dynamic";

export default async function AdminSurveyPage() {
  const admin = createAdminClient();

  const [config, responses, done, { count: staff }] = await Promise.all([
    getSurveyConfig(admin),
    loadResponses(admin),
    countDone(admin),
    admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_guest", false)
      .in("role", ["mop", "rop", "trainee", "mentor"])
      .not("email", "like", "%.test@pactocoins.local"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold">Опрос команды</h1>
        <p className="text-sm text-gray-400 mt-1">
          Анонимный. Ты видишь, сколько человек прошли, но не кто что ответил. Каждому за ответы начисляется{" "}
          {SURVEY_REWARD_CHIPS} фишек.
        </p>
      </div>
      <SurveyResultsClient open={config.rawOpen} endsAt={config.endsAt} expired={config.expired} responses={responses} done={done} staff={staff ?? 0} />
    </div>
  );
}
