import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { formatDateTimeAlmaty, formatPaymentDay } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const ACTION_LABELS = {
  create: "Подана",
  approve: "Одобрена",
  reject: "Отклонена",
  edit: "Исправлена",
  delete: "Удалена",
  cancel: "Отменена",
  other: "Другое",
};

const SOURCE_LABELS = { web: "сайт", telegram: "Telegram", system: "система" };

const ACTION_TONE = {
  create: "text-gray-300 bg-white/5",
  approve: "text-emerald-400 bg-emerald-400/10",
  reject: "text-orange-400 bg-orange-400/10",
  edit: "text-acid-400 bg-acid-400/10",
  delete: "text-red-400 bg-red-400/10",
  cancel: "text-red-400 bg-red-400/10",
  other: "text-gray-400 bg-white/5",
};

function money(n) {
  return `${Number(n).toLocaleString("ru-RU")} ₸`;
}

// Человеческое описание записи: что именно произошло.
function describe(row) {
  const b = row.before ?? {};
  const a = row.after ?? {};
  const parts = [];

  if (row.action === "create") {
    parts.push(`Заявка подана${a.amount_kzt != null ? `: ${money(a.amount_kzt)}` : ""}`);
  } else if (row.action === "approve") {
    const where = row.source === "telegram" ? "Одобрено в Telegram" : "Одобрено в админке";
    parts.push(a.amount_kzt != null ? `${where}: ${money(a.amount_kzt)}` : where);
    if (a.credited_coins != null) parts.push(`Начислено коинов: ${a.credited_coins}`);
  } else if (row.action === "reject") {
    const where = row.source === "telegram" ? "Отклонено в Telegram" : "Заявка отклонена";
    parts.push(a.amount_kzt != null ? `${where}: ${money(a.amount_kzt)}` : where);
  } else if (row.action === "cancel") {
    parts.push("Оплата отменена, коины списаны");
    if (b.amount_kzt != null) parts.push(`Была ${money(b.amount_kzt)}`);
  } else if (row.action === "delete") {
    parts.push("Оплата удалена");
    if (b.amount_kzt != null) parts.push(`Была ${money(b.amount_kzt)}`);
  } else if (row.action === "edit") {
    if (b.amount_kzt != null && a.amount_kzt != null && b.amount_kzt !== a.amount_kzt) {
      parts.push(`Сумма ${Number(b.amount_kzt).toLocaleString("ru-RU")} → ${Number(a.amount_kzt).toLocaleString("ru-RU")}`);
    }
    if (b.earned_at && a.earned_at && b.earned_at !== a.earned_at) {
      parts.push(`Дата оплаты ${formatPaymentDay(b.earned_at)} → ${formatPaymentDay(a.earned_at)}`);
    }
    if (b.client_name !== undefined && a.client_name !== undefined && b.client_name !== a.client_name) {
      parts.push(`ФИО ${b.client_name || "пусто"} → ${a.client_name || "пусто"}`);
    }
    if (b.credited_coins != null && a.credited_coins != null && b.credited_coins !== a.credited_coins) {
      parts.push(`Коины ${b.credited_coins} → ${a.credited_coins}`);
    }
    if (!parts.length) parts.push("Оплата исправлена");
  } else {
    parts.push("Другое изменение");
  }

  return parts;
}

export default async function AuditPage({ searchParams }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/admin");

  const userFilter = typeof searchParams?.user === "string" ? searchParams.user : "";
  const actionFilter = typeof searchParams?.action === "string" ? searchParams.action : "";

  const admin = createAdminClient();

  const { data: employees } = await admin
    .from("users")
    .select("id, name")
    .in("role", ["mop", "rop", "trainee"])
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local")
    .order("name");

  let q = admin
    .from("revenue_audit")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (userFilter) q = q.eq("user_id", userFilter);
  if (ACTION_LABELS[actionFilter]) q = q.eq("action", actionFilter);
  const { data: rows, error } = await q;

  const header = (
    <div>
      <h1 className="text-2xl font-display font-bold">Журнал оплат</h1>
      <p className="text-sm text-gray-500 mt-1">
        Кто, когда и что сделал с оплатой: подал, одобрил, исправил, отменил, удалил.
        Показаны последние 200 записей.
      </p>
    </div>
  );

  if (error) {
    return (
      <div className="space-y-4">
        {header}
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 text-sm text-gray-400">
          Журнал ещё не включён.
        </div>
      </div>
    );
  }

  const list = rows ?? [];

  // Имена сотрудников и ФИО клиентов для подписей.
  const ids = [...new Set(list.map((r) => r.user_id).filter(Boolean))];
  const reqIds = [...new Set(list.map((r) => r.request_id).filter(Boolean))];
  const names = new Map((employees ?? []).map((e) => [e.id, e.name]));
  const missing = ids.filter((id) => !names.has(id));
  if (missing.length) {
    const { data } = await admin.from("users").select("id, name").in("id", missing);
    for (const u of data ?? []) names.set(u.id, u.name);
  }
  const clients = new Map();
  if (reqIds.length) {
    const { data } = await admin.from("revenue_requests").select("id, client_name").in("id", reqIds);
    for (const r of data ?? []) if (r.client_name) clients.set(r.id, r.client_name);
  }

  return (
    <div className="space-y-4">
      {header}

      <form method="get" className="flex flex-col sm:flex-row gap-2">
        <select
          name="user"
          defaultValue={userFilter}
          className="bg-dark-800 border border-dark-600 rounded-xl px-3 py-2 text-sm min-w-0 sm:w-64"
        >
          <option value="">Все сотрудники</option>
          {(employees ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <select
          name="action"
          defaultValue={actionFilter}
          className="bg-dark-800 border border-dark-600 rounded-xl px-3 py-2 text-sm min-w-0 sm:w-52"
        >
          <option value="">Все действия</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-acid-400 text-black font-semibold rounded-xl px-4 py-2 text-sm"
          >
            Показать
          </button>
          {(userFilter || actionFilter) && (
            <Link
              href="/admin/audit"
              className="border border-dark-600 text-gray-400 rounded-xl px-4 py-2 text-sm"
            >
              Сбросить
            </Link>
          )}
        </div>
      </form>

      {list.length === 0 ? (
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 text-sm text-gray-400">
          Записей пока нет. Здесь появятся новые действия с оплатами.
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((r) => {
            const who = names.get(r.user_id);
            const client =
              r.after?.client_name || r.before?.client_name || clients.get(r.request_id);
            return (
              <div
                key={r.id}
                className="bg-dark-800 border border-dark-600 rounded-xl p-3 space-y-1.5 min-w-0"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                      ACTION_TONE[r.action] ?? ACTION_TONE.other
                    }`}
                  >
                    {ACTION_LABELS[r.action] ?? r.action}
                  </span>
                  <span className="text-xs text-gray-500">{formatDateTimeAlmaty(r.created_at)}</span>
                </div>
                <div className="text-sm break-words">
                  {describe(r).map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
                <div className="text-xs text-gray-500 break-words">
                  Оплата: {who ?? "сотрудник удалён"}
                  {client ? `, клиент ${client}` : ""}
                </div>
                <div className="text-xs text-gray-500 break-words">
                  Сделал: {r.actor_name || "не определён"} ({SOURCE_LABELS[r.source] ?? r.source})
                </div>
                {r.note && (
                  <div className="text-xs text-gray-400 break-words">Комментарий: {r.note}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
