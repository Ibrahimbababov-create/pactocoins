import { createClient } from "@/lib/supabase-server";
import AnonymousMessageForm from "@/components/AnonymousMessageForm";
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

  if (canView) {
    const { data: messages } = await supabase
      .from("anonymous_messages")
      .select("id, content, created_at")
      .order("created_at", { ascending: false });

    return (
      <div className="space-y-4">
        <Link href="/messages" className="text-gray-500 text-sm">
          ← Назад
        </Link>
        <h1 className="text-2xl font-bold">Анонимные сообщения</h1>
        <p className="text-sm text-gray-500">
          Кто отправил — не видно никому, включая администратора.
        </p>

        <div className="space-y-2">
          {messages?.length === 0 && (
            <p className="text-gray-600 text-sm">Пока пусто</p>
          )}
          {messages?.map((m) => (
            <div
              key={m.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4"
            >
              <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              <p className="text-xs text-gray-600 mt-2">
                {new Date(m.created_at).toLocaleString("ru-RU")}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

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
    </div>
  );
}
