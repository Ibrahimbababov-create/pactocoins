import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import MyPaymentsClient from "@/components/MyPaymentsClient";
import PaymentsTitle from "@/components/PaymentsTitle";
import EmptyState from "@/components/EmptyState";
import { resolveViewer } from "@/lib/viewAs";
import {
  currentMonthKeyAlmaty,
  monthRangeAlmaty,
  recentMonthKeysAlmaty,
} from "@/lib/timezone";

const ALLOWED_ROLES = ["mop", "rop", "mentor", "trainee"];

export default async function MyPaymentsPage({ searchParams }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // В режиме просмотра админ видит оплаты того, чьими глазами смотрит.
  const { viewId } = await resolveViewer(supabase, user.id);

  const { data: profile } = await supabase
    .from("users")
    .select("role, is_guest")
    .eq("id", viewId)
    .single();

  if (profile?.is_guest || !ALLOWED_ROLES.includes(profile?.role)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Мои оплаты</h1>
        <EmptyState
          icon="receipt"
          title="Раздел недоступен"
          hint="Мои оплаты есть у менеджеров, РОПов, наставников и стажёров."
          action={
            <Link
              href="/mop"
              className="inline-block bg-acid-400 text-black font-bold rounded-xl px-5 py-2.5 text-sm active:scale-95"
            >
              На главную
            </Link>
          }
        />
      </div>
    );
  }

  const months = recentMonthKeysAlmaty(12);
  const asked = searchParams?.m;
  const monthKey = months.some((m) => m.key === asked) ? asked : currentMonthKeyAlmaty();
  const range = monthRangeAlmaty(monthKey);

  // Дата оплаты - earned_at; у совсем старых заявок её нет, берём дату подачи.
  const { data: rows } = await supabase
    .from("revenue_requests")
    .select("id, client_name, product_kind, pay_kind, is_final_part, amount_kzt, status, earned_at, created_at")
    .eq("user_id", viewId)
    .neq("status", "rejected")
    .or(
      `and(earned_at.gte.${range.start},earned_at.lt.${range.end}),and(earned_at.is.null,created_at.gte.${range.start},created_at.lt.${range.end})`
    )
    .order("earned_at", { ascending: false, nullsFirst: false })
    .limit(500);

  // Исправления, которые человек предлагал к оплатам этого месяца. Нет
  // таблицы (миграция ещё не применена): кнопку исправления не показываем.
  const ids = new Set((rows ?? []).map((r) => r.id));
  const { data: editRows, error: editsError } = await supabase
    .from("revenue_edit_requests")
    .select("id, request_id, status, proposed, reason, admin_comment, created_at, reviewed_at")
    .eq("user_id", viewId)
    .order("created_at", { ascending: false })
    .limit(500);
  const editsEnabled = !editsError;
  const edits = (editRows ?? []).filter((e) => ids.has(e.request_id));

  return (
    <div className="space-y-4">
      <div>
        <Link href="/mop/history" className="text-xs text-gray-500">
          К истории
        </Link>
        <PaymentsTitle />
        <p className="text-sm text-gray-500 mt-1">
          Сверь с гугл-таблицей: все оплаты клиентов за месяц.
        </p>
      </div>

      <MyPaymentsClient
        months={months}
        monthKey={monthKey}
        monthLabel={range.label}
        rows={rows ?? []}
        edits={edits}
        editsEnabled={editsEnabled}
      />
    </div>
  );
}
