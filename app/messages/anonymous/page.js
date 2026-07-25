import { createClient } from "@/lib/supabase-server";
import AnonymousMessageForm from "@/components/AnonymousMessageForm";
import AnonymousMessagesList from "@/components/AnonymousMessagesList";
import Link from "next/link";

export default async function AnonymousMessagesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const canView = profile?.role === "admin" || profile?.role === "observer";

  const { data: messages } = canView
    ? await supabase
        .from("anonymous_messages")
        .select("id, content, created_at")
        .order("created_at", { ascending: false })
    : { data: null };

  return (
    <div className="space-y-4">
      <Link href="/messages" className="text-gray-500 text-sm">
        ← Назад
      </Link>
      <h1 className="text-2xl font-bold">Анонимное сообщение</h1>
      <p className="text-sm text-gray-500">
        Уйдёт админу без указания вашего имени.
      </p>
      <AnonymousMessageForm />

      {canView && (
        <div className="space-y-2 pt-6 mt-6 border-t border-dark-600">
          <h2 className="text-lg font-bold">Входящие анонимные сообщения</h2>
          <p className="text-sm text-gray-500">
            Кто отправил — не видно никому, включая администратора.
          </p>

          <AnonymousMessagesList
            messages={messages}
            canDelete={profile?.role === "admin"}
          />
        </div>
      )}
    </div>
  );
}
