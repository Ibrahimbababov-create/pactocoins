"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function sendAnonymousMessage(content) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };
  if (!content || !content.trim()) return { error: "Пустое сообщение" };

  const { error } = await supabase.from("anonymous_messages").insert({
    sender_id: user.id,
    content: content.trim(),
  });

  if (error) return { error: "Не удалось отправить" };

  revalidatePath("/messages/anonymous");
  return { success: true };
}
