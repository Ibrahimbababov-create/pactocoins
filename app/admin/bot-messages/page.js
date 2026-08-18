import { createClient } from "@/lib/supabase-server";
import Link from "next/link";

export default async function BotMessagesPage() {
  const supabase = createClient();

  const { data: messages } = await supabase
    .from("bot_inbox_messages")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: users } = await supabase
    .from("users")
    .select("id, name, telegram_id")
    .not("telegram_id", "is", null);

  const userByTelegramId = {};
  users?.forEach((u) => {
    userByTelegramId[u.telegram_id] = u;
  });

  const threads = {};
  messages?.forEach((m) => {
    const key = m.telegram_id;
    if (!threads[key]) {
      threads[key] = { last: m, unread: 0 };
    }
    if (!m.read_at) threads[key].unread += 1;
  });

  const contacts = Object.entries(threads)
    .map(([telegramId, t]) => ({
      telegramId,
      name:
        userByTelegramId[telegramId]?.name ||
        t.last.telegram_name ||
        `id ${telegramId}`,
      lastText: t.last.text,
      lastAt: t.last.created_at,
      unread: t.unread,
    }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Сообщения боту</h1>
      <p className="text-sm text-gray-500">
        То, что сотрудники пишут боту в личку в Telegram (не команды)
      </p>

      {contacts.length === 0 && (
        <p className="text-gray-600 text-sm">Пока никто не писал</p>
      )}

      <div className="space-y-2">
        {contacts.map((c) => (
          <Link
            key={c.telegramId}
            href={`/admin/bot-messages/${c.telegramId}`}
            className="flex items-center justify-between bg-dark-800 border border-dark-600 rounded-xl p-4"
          >
            <div className="min-w-0">
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-gray-500 truncate max-w-[280px]">
                {c.lastText}
              </p>
            </div>
            {c.unread > 0 && (
              <span className="bg-acid-400 text-black text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">
                {c.unread}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
