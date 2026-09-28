"use server";

import { createClient } from "@/lib/supabase-server";

const SOURCES = {
  revenue: {
    table: "revenue_requests",
    select: "*, users!revenue_requests_user_id_fkey(name, email, is_guest)",
  },
  bonus: {
    table: "bonus_requests",
    select: "*, users!bonus_requests_user_id_fkey(name, email, is_guest)",
  },
};

// История заявок живёт на сервере и приезжает порциями. Раньше страница
// тянула все 329 записей разом ради двадцати видимых.
export async function loadRequestHistory(kind, offset = 0, limit = 20) {
  const cfg = SOURCES[kind];
  if (!cfg) return { error: "Неизвестный раздел" };

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

  const { data, error } = await supabase
    .from(cfg.table)
    .select(cfg.select)
    .neq("status", "pending")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return { error: error.message };
  return { rows: data ?? [] };
}
