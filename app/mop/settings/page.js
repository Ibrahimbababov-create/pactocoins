import { createClient } from "@/lib/supabase-server";
import EditableName from "@/components/EditableName";
import RulesAccordion from "@/components/RulesAccordion";
import ReminderSettings from "@/components/ReminderSettings";
import NotificationSettings from "@/components/NotificationSettings";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select(
      "name, reminder_enabled, reminder_time, notify_requests, notify_shop, notify_goal, notify_rating"
    )
    .eq("id", user.id)
    .single();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Настройки</h1>

      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-2">
        <p className="text-sm text-gray-500">Профиль</p>
        <EditableName name={profile?.name ?? ""} />
      </div>

      <NotificationSettings prefs={profile ?? {}} />

      <ReminderSettings
        enabled={profile?.reminder_enabled ?? false}
        time={profile?.reminder_time?.slice(0, 5) ?? ""}
      />

      <RulesAccordion />
    </div>
  );
}
