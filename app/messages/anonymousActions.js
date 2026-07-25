"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

export async function deleteAnonymousMessage(id) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Доступ запрещён" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("anonymous_messages")
    .delete()
    .eq("id", id);

  if (error) return { error: "Не удалось удалить" };

  revalidatePath("/messages/anonymous");
  return { success: true };
}

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
