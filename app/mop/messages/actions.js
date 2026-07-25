"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function sendMessage(recipientId, content, isAnonymous) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };
  if (!content || !content.trim()) return { error: "Пустое сообщение" };
  if (!recipientId) return { error: "Не выбран получатель" };

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: recipientId,
    content: content.trim(),
    is_anonymous: !!isAnonymous,
  });

  if (error) return { error: "Не удалось отправить" };

  revalidatePath(`/mop/messages/${recipientId}`);
  revalidatePath("/mop/messages");
  revalidatePath("/mop");
  return { success: true };
}

export async function markThreadRead(otherUserId) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .eq("sender_id", otherUserId)
    .is("read_at", null);

  revalidatePath("/mop/messages");
}
