import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import FundsClient from "@/components/FundsClient";
import Icon from "@/components/Icon";

// Общее содержимое «Копилок» для МОП/РОП и Наблюдателя — каждая роль
// рендерит его внутри своего layout (со своей навигацией), а не как
// отдельную страницу без меню.
export default async function FundsPageContent() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("balance")
    .eq("id", user.id)
    .single();

  // Список копилок и то, кто сколько внёс, должно быть видно всем
  // (прозрачность) — RLS на users не даёт обычному МОПу читать имена
  // других людей напрямую, поэтому эту часть читаем admin-клиентом.
  const admin = createAdminClient();

  const { data: funds } = await admin
    .from("funds")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const fundIds = (funds ?? []).map((f) => f.id);

  const { data: contributions } = fundIds.length
    ? await admin
        .from("fund_contributions")
        .select("*, users(name)")
        .in("fund_id", fundIds)
    : { data: [] };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Icon name="piggy" className="w-6 h-6 text-gray-400" />
        Копилки
      </h1>
      <FundsClient
        funds={funds ?? []}
        contributions={contributions ?? []}
        balance={profile?.balance ?? 0}
      />
    </div>
  );
}
