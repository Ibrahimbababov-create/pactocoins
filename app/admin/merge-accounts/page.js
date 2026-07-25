import { createClient } from "@/lib/supabase-server";
import MergeAccountsClient from "@/components/MergeAccountsClient";

export default async function MergeAccountsPage() {
  const supabase = createClient();

  const { data: employees } = await supabase
    .from("users")
    .select("id, name, email, balance, total_earned")
    .eq("role", "mop")
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Слияние аккаунтов</h1>
      <p className="text-sm text-gray-500">
        Если у сотрудника пропал доступ к старому Telegram — он заходит
        через бота заново и получает новый пустой аккаунт. Здесь можно
        перенести весь баланс и историю со старого аккаунта на новый.
        Старый после этого удаляется навсегда.
      </p>
      <MergeAccountsClient employees={employees ?? []} />
    </div>
  );
}
