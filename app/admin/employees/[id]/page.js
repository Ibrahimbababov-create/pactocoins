import { createClient } from "@/lib/supabase-server";
import Link from "next/link";

export default async function EmployeeHistoryPage({ params }) {
  const supabase = createClient();
  const { id } = params;

  const { data: employee } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", id)
    .order("created_at", { ascending: false });

  if (!employee) {
    return <p className="text-gray-500">Сотрудник не найден</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/employees" className="text-sm text-gray-500">
        ← Назад к сотрудникам
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{employee.name}</h1>
        <p className="text-gray-500 text-sm">{employee.email}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Баланс</p>
          <p className="text-2xl font-bold text-acid-400">
            {employee.balance}
          </p>
        </div>
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <p className="text-xs text-gray-500">Всего заработано</p>
          <p className="text-2xl font-bold">{employee.total_earned}</p>
        </div>
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4">
          <p className="text-xs text-gray-500">За этот месяц</p>
          <p className="text-2xl font-bold">{employee.month_earned}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-500">Полная история операций</p>
        {transactions?.length === 0 && (
          <p className="text-gray-600 text-sm">Операций пока нет</p>
        )}
        {transactions?.map((t) => {
          const isNegative = t.amount_coins < 0;
          return (
            <div
              key={t.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold">{t.description || t.type}</p>
                <p className="text-xs text-gray-600">
                  {new Date(t.created_at).toLocaleString("ru-RU")}
                </p>
              </div>
              <span
                className={`font-bold ${
                  isNegative ? "text-red-400" : "text-acid-400"
                }`}
              >
                {isNegative ? "" : "+"}
                {t.amount_coins}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
