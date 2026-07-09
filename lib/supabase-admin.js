import { createClient } from "@supabase/supabase-js";

// ВНИМАНИЕ: используется только в server actions / route handlers.
// service_role ключ обходит RLS — никогда не импортировать в client components.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
