import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { chestEligible } from "@/lib/chest";
import { getSurveyConfig, hasDone } from "@/lib/survey";
import SurveyClient from "@/components/SurveyClient";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

function Notice({ icon = "lock", title, text }) {
  return (
    <div className="rounded-2xl border border-dark-600 bg-dark-800 p-6 text-center space-y-2">
      <Icon name={icon} className="w-8 h-8 mx-auto text-gray-500" />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

export default async function SurveyPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const { data: me } = await admin
    .from("users")
    .select("id, role, is_active, is_guest, email")
    .eq("id", user.id)
    .single();

  // Админ и гость могут пройти опрос «понарошку»: посмотреть, как он выглядит.
  const preview = me?.role === "admin" || Boolean(me?.is_guest);

  let body;
  if (preview) {
    body = <SurveyClient preview />;
  } else if (!chestEligible(me)) {
    body = <Notice title="Опрос для команды" text="Он открывается только сотрудникам." />;
  } else if (!(await getSurveyConfig(admin)).open) {
    body = <Notice icon="clock" title="Опрос пока закрыт" text="Когда он откроется, бот пришлёт сообщение." />;
  } else if (await hasDone(admin, me.id)) {
    body = <Notice icon="check" title="Ты уже прошёл опрос" text="Спасибо, ответы учтены. Фишки у тебя на балансе." />;
  } else {
    body = <SurveyClient />;
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/mop/more"
          className="inline-flex items-center gap-1 -ml-1 py-1 pr-2 text-sm text-gray-400 active:opacity-60"
        >
          <Icon name="chevronLeft" className="w-4 h-4" />
          Ещё
        </Link>
        <h1 className="text-2xl font-display font-bold mt-1">Опрос команды</h1>
      </div>
      {body}
    </div>
  );
}
