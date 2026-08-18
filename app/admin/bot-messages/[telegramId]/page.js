import { createClient } from "@/lib/supabase-server";
import Link from "next/link";

export default async function BotMessageThreadPage({ params }) {
  const supabase = createClient();
  const { telegramId } = params;

  const { data: messages } = await supabase
    .from("bot_inbox_messages")
    .select("*")
    .eq("telegram_id", telegramId)
    .order("created_at", { ascending: true });

  const { data: user } = await supabase
    .from("users")
    .select("name")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  await supabase
    .from("bot_inbox_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("telegram_id", telegramId)
    .is("read_at", null);

  const displayName =
    user?.name || messages?.[0]?.telegram_name || `id ${telegramId}`;

  return (
    <div className="space-y-4">
      <Link href="/admin/bot-messages" className="text-gray-500 text-sm">
        ← Назад
      </Link>

      <h1 className="text-xl font-bold">{displayName}</h1>

      <div className="space-y-2">
        {messages?.length === 0 && (
          <p className="text-gray-600 text-sm">Сообщений нет</p>
        )}
        {messages?.map((m) => (
          <div
            key={m.id}
            className="bg-dark-800 border border-dark-600 rounded-xl p-3"
          >
            <p className="text-sm whitespace-pre-wrap">{m.text}</p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(m.created_at).toLocaleString("ru-RU")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
