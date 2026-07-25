import { createClient } from "@/lib/supabase-server";
import MessageThread from "@/components/MessageThread";
import { markThreadRead } from "@/app/messages/actions";

export default async function MessageThreadPage({ params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const otherId = params.userId;

  const { data: otherUser } = await supabase
    .from("users")
    .select("id, name")
    .eq("id", otherId)
    .single();

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true });

  await markThreadRead(otherId);

  return (
    <MessageThread
      currentUserId={user.id}
      otherUser={otherUser}
      initialMessages={messages ?? []}
    />
  );
}
