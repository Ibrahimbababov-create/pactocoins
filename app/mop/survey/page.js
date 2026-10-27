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

export default async function SurveyPage({ searchParams }) {
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

  const isAdmin = me?.role === "admin";
  const config = await getSurveyConfig(admin);
  const open = config.open;
  // Гость смотрит опрос понарошку. Админ отвечает по-настоящему, даже пока
  // опрос закрыт для команды, а «понарошку» открывает через ?preview=1.
  const preview = Boolean(me?.is_guest) || (isAdmin && searchParams?.preview === "1");

  let body;
  if (preview) {
    body = <SurveyClient preview />;
  } else if (!chestEligible(me)) {
    body = <Notice title="Опрос для команды" text="Он открывается только сотрудникам." />;
  } else if (!isAdmin && config.expired) {
    body = <Notice icon="clock" title="Опрос закончился" text="Приём ответов закрыт, спасибо всем, кто прошёл." />;
  } else if (!isAdmin && !open) {
    body = <Notice icon="clock" title="Опрос пока закрыт" text="Когда он откроется, бот пришлёт сообщение." />;
  } else if (await hasDone(admin, me.id)) {
    body = <Notice icon="check" title="Ты уже прошёл опрос" text="Спасибо, ответы учтены. Фишки у тебя на балансе." />;
  } else {
    body = (
      <>
        {isAdmin && !open && (
          <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-2.5 text-xs text-amber-300">
            Для команды опрос пока закрыт. Ты проходишь его первым: ответы сохранятся и фишки начислятся по-настоящему.
          </p>
        )}
        <SurveyClient />
      </>
    );
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
