import { createClient } from "@/lib/supabase-server";
import Link from "next/link";

export default async function AdminMessagesListPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: allUsers } = await supabase
    .from("users")
    .select("id, name")
    .neq("id", user.id);

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const threads = {};
  messages?.forEach((m) => {
    const otherId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
    if (!threads[otherId]) {
      threads[otherId] = { lastMessage: m, unread: 0 };
    }
    if (m.recipient_id === user.id && !m.read_at) {
      threads[otherId].unread += 1;
    }
  });

  const contacts = (allUsers ?? [])
    .map((u) => ({
      ...u,
      lastMessage: threads[u.id]?.lastMessage ?? null,
      unread: threads[u.id]?.unread ?? 0,
    }))
    .sort((a, b) => {
      const at = a.lastMessage?.created_at ?? "";
      const bt = b.lastMessage?.created_at ?? "";
      return bt.localeCompare(at);
    });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Сообщения</h1>

      <div className="space-y-2">
        {contacts.map((c) => (
          <Link
            key={c.id}
            href={`/admin/messages/${c.id}`}
            className="flex items-center justify-between bg-dark-800 border border-dark-600 rounded-xl p-4"
          >
            <div className="min-w-0">
              <p className="font-semibold">{c.name}</p>
              {c.lastMessage && (
                <p className="text-xs text-gray-500 truncate max-w-[220px]">
                  {c.lastMessage.sender_id === user.id ? "Вы: " : ""}
                  {c.lastMessage.is_anonymous &&
                  c.lastMessage.sender_id !== user.id
                    ? "Анонимное сообщение"
                    : c.lastMessage.content}
                </p>
              )}
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
