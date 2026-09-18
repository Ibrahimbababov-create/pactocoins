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
      global: {
        // Next.js кэширует fetch() даже в "force-dynamic" роуте, если в нём
        // не используется cookies()/headers() — а этот клиент их не трогает.
        // Из-за этого /api/rops отдавал список РОПов на момент прошлого
        // деплоя, игнорируя новых/уволенных. Кэш тут не нужен нигде —
        // service_role используется только для серверных операций.
        fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
      },
    }
  );
}
