import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { formatDateTimeAlmaty, formatPaymentDay } from "@/lib/timezone";
import { clientKey, revenueKindText } from "@/lib/revenueKinds";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

// Поля client_name / pay_kind появились 27.10.2026 (PR #57). У заявок,
// созданных раньше, они пустые не по ошибке, поэтому проверки про ФИО и
// вид оплаты смотрят только на заявки не старше этой даты.
const KINDS_SINCE = "2026-10-27T00:00:00+05:00";

const WINDOWS = [30, 60, 90];
const DAY = 24 * 60 * 60 * 1000;
const DUP_WINDOW_DAYS = 3; // сколько дней между одинаковыми оплатами считаем подозрительным
const SMALL_AMOUNT = 10000; // оплаты на эту сумму и меньше
const HANGING_PART_DAYS = 14; // сколько дней часть может ждать остальных
const PENDING_HOURS = 48; // сколько заявка может ждать решения
const LIST_LIMIT = 50; // строк в раскрытом списке

function money(n) {
  return `${Number(n).toLocaleString("ru-RU")} ₸`;
}

function payDate(r) {
  return r.earned_at ?? r.created_at;
}

function dayDiff(a, b) {
  return Math.abs(new Date(payDate(a)) - new Date(payDate(b))) / DAY;
}

function statusText(r) {
  return r.status === "pending" ? "ждёт решения" : "одобрена";
}

function Row({ person, name, children, href, linkText }) {
  return (
    <div className="bg-dark-900/50 border border-dark-600 rounded-xl p-3 space-y-1 min-w-0 break-words">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link href={`/admin/employees/${person}`} className="text-sm font-semibold text-acid-400">
          {name}
        </Link>
        <Link href={href ?? "/admin/payments"} className="text-xs text-gray-400 underline">
          {linkText ?? "К оплатам"}
        </Link>
      </div>
      {children}
    </div>
  );
}

export default async function HealthPage({ searchParams }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/admin");

  const days = WINDOWS.includes(Number(searchParams?.days)) ? Number(searchParams.days) : 60;
  const now = Date.now();
  const sinceIso = new Date(now - days * DAY).toISOString();

  const admin = createAdminClient();

  // Только живые сотрудники: без уволенных, гостя и тестовых аккаунтов.
  const { data: people } = await admin
    .from("users")
    .select("id, name")
    .eq("is_active", true)
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local");
  const names = new Map((people ?? []).map((p) => [p.id, p.name]));

  const cols =
    "id, user_id, amount_kzt, status, credited_coins, client_name, product_kind, pay_kind, is_final_part, earned_at, created_at";

  const [{ data: windowRows }, { data: partRows }] = await Promise.all([
    admin
      .from("revenue_requests")
      .select(cols)
      .in("status", ["approved", "pending"])
      .or(`created_at.gte.${sinceIso},earned_at.gte.${sinceIso}`)
      .order("created_at", { ascending: false })
      .limit(3000),
    // Части и последние части смотрим без окна: часть могла повиснуть давно.
    admin
      .from("revenue_requests")
      .select(cols)
      .in("status", ["approved", "pending"])
      .not("pay_kind", "is", null)
      .limit(3000),
  ]);

  const rows = (windowRows ?? []).filter((r) => names.has(r.user_id));
  const who = (r) => names.get(r.user_id) ?? "сотрудник";
  const dayOf = (r) => formatPaymentDay(payDate(r)).slice(0, 5);

  // 1. Возможные дубли
  const dupPairs = [];
  const byUserAmount = new Map();
  for (const r of rows) {
    if (!(r.amount_kzt > 0)) continue;
    const key = `${r.user_id}|${r.amount_kzt}`;
    if (!byUserAmount.has(key)) byUserAmount.set(key, []);
    byUserAmount.get(key).push(r);
  }
  for (const group of byUserAmount.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const ka = clientKey(a.client_name);
        const kb = clientKey(b.client_name);
        let hit = false;
        if (ka && kb) hit = ka === kb && dayDiff(a, b) <= DUP_WINDOW_DAYS;
        else if (!ka && !kb) hit = dayOf(a) === dayOf(b);
        if (hit) dupPairs.push([a, b]);
      }
    }
  }

  // 2. Мелкие оплаты
  const small = rows.filter((r) => r.amount_kzt > 0 && r.amount_kzt <= SMALL_AMOUNT);

  // 3. Без ФИО и без вида оплаты (только новые заявки)
  const noInfo = rows.filter(
    (r) => r.created_at >= KINDS_SINCE && (!r.client_name || !r.pay_kind || !r.product_kind)
  );

  // 4. Висящие части
  const partGroups = new Map();
  for (const r of (partRows ?? []).filter((x) => names.has(x.user_id) && x.client_name)) {
    const key = `${r.user_id}|${clientKey(r.client_name)}`;
    if (!partGroups.has(key)) partGroups.set(key, []);
    partGroups.get(key).push(r);
  }
  const hanging = [];
  for (const group of partGroups.values()) {
    if (group.some((r) => r.is_final_part)) continue;
    const parts = group.filter((r) => r.pay_kind === "part");
    if (!parts.length) continue;
    const oldest = Math.min(...parts.map((r) => new Date(payDate(r)).getTime()));
    const waiting = Math.floor((now - oldest) / DAY);
    if (waiting <= HANGING_PART_DAYS) continue;
    hanging.push({
      user_id: parts[0].user_id,
      client: parts[0].client_name,
      total: parts.reduce((s, r) => s + Number(r.amount_kzt || 0), 0),
      count: parts.length,
      waiting,
    });
  }
  hanging.sort((a, b) => b.waiting - a.waiting);

  // 5. Долго ждут решения
  const stale = rows
    .filter(
      (r) =>
        r.status === "pending" &&
        now - new Date(r.created_at).getTime() > PENDING_HOURS * 3600 * 1000
    )
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // 6. Подтверждено, а коинов нет
  const noCoins = rows.filter(
    (r) => r.status === "approved" && r.amount_kzt > 0 && !(r.credited_coins > 0)
  );

  const blocks = [
    {
      key: "dups",
      title: "Возможные дубли",
      hint: "Одна и та же сумма у одного сотрудника: с тем же клиентом в пределах 3 дней или в один день, если ФИО нет. Возможно, оплату подали дважды.",
      alert: true,
      count: dupPairs.length,
      render: () =>
        dupPairs.slice(0, LIST_LIMIT).map(([a, b]) => (
          <Row key={a.id + b.id} person={a.user_id} name={who(a)}>
            <div className="text-sm">
              {money(a.amount_kzt)}
              {a.client_name ? `, клиент ${a.client_name}` : ", ФИО не указано"}
            </div>
            <div className="text-xs text-gray-500">
              Первая: {formatPaymentDay(payDate(a))}, {statusText(a)}. Вторая:{" "}
              {formatPaymentDay(payDate(b))}, {statusText(b)}.
            </div>
          </Row>
        )),
    },
    {
      key: "small",
      title: "Мелкие оплаты",
      hint: "Оплаты на 10 000 ₸ и меньше. Это могут быть предоплаты, а могут быть тестовые. Проверь, что всё настоящее.",
      alert: false,
      count: small.length,
      render: () =>
        small.slice(0, LIST_LIMIT).map((r) => (
          <Row key={r.id} person={r.user_id} name={who(r)}>
            <div className="text-sm">
              {money(r.amount_kzt)}
              {r.client_name ? `, клиент ${r.client_name}` : ""}
            </div>
            <div className="text-xs text-gray-500">
              {formatPaymentDay(payDate(r))}, {statusText(r)}
            </div>
          </Row>
        )),
    },
    {
      key: "noinfo",
      title: "Нет ФИО клиента или вида оплаты",
      hint: "Смотрим только заявки, поданные с 27.10.2026: раньше этих полей в форме не было.",
      alert: true,
      count: noInfo.length,
      render: () =>
        noInfo.slice(0, LIST_LIMIT).map((r) => {
          const missing = [];
          if (!r.client_name) missing.push("ФИО клиента");
          if (!r.product_kind) missing.push("что куплено");
          if (!r.pay_kind) missing.push("целиком или часть");
          return (
            <Row key={r.id} person={r.user_id} name={who(r)}>
              <div className="text-sm">
                {money(r.amount_kzt)}, {formatPaymentDay(payDate(r))}
              </div>
              <div className="text-xs text-gray-500">Не указано: {missing.join(", ")}</div>
            </Row>
          );
        }),
    },
    {
      key: "parts",
      title: "Висящие части",
      hint: "Клиент платит частями, а последней части нет больше 14 дней. Либо клиент не доплатил, либо забыли отметить последнюю часть.",
      alert: true,
      count: hanging.length,
      render: () =>
        hanging.slice(0, LIST_LIMIT).map((h) => (
          <Row key={h.user_id + h.client} person={h.user_id} name={names.get(h.user_id)}>
            <div className="text-sm break-words">
              Клиент {h.client}: {money(h.total)}
            </div>
            <div className="text-xs text-gray-500">
              Частей: {h.count}, висит {h.waiting} дн.
            </div>
          </Row>
        )),
    },
    {
      key: "stale",
      title: "Ждут решения больше 2 суток",
      hint: "Заявки на выручку, которые никто не одобрил и не отклонил.",
      alert: true,
      count: stale.length,
      render: () =>
        stale.slice(0, LIST_LIMIT).map((r) => (
          <Row
            key={r.id}
            person={r.user_id}
            name={who(r)}
            href="/admin/revenue-requests"
            linkText="К заявкам"
          >
            <div className="text-sm">
              {money(r.amount_kzt)}
              {r.client_name ? `, клиент ${r.client_name}` : ""}
            </div>
            <div className="text-xs text-gray-500">
              Подана {formatDateTimeAlmaty(r.created_at)}, ждёт{" "}
              {Math.floor((now - new Date(r.created_at).getTime()) / DAY)} дн.
            </div>
          </Row>
        )),
    },
    {
      key: "coins",
      title: "Одобрено, а коинов нет",
      hint: "Подтверждённая оплата, по которой не записаны начисленные коины. Возможно, начисление не прошло. Ничего не пересчитываем, только показываем.",
      alert: true,
      count: noCoins.length,
      render: () =>
        noCoins.slice(0, LIST_LIMIT).map((r) => (
          <Row key={r.id} person={r.user_id} name={who(r)}>
            <div className="text-sm">
              {money(r.amount_kzt)}
              {r.client_name ? `, клиент ${r.client_name}` : ""}
            </div>
            <div className="text-xs text-gray-500">
              {formatPaymentDay(payDate(r))}, коины: {r.credited_coins ?? "не записаны"}
              {revenueKindText(r) ? `, ${revenueKindText(r)}` : ""}
            </div>
          </Row>
        )),
    },
  ];

  const attention = blocks.filter((b) => b.alert).reduce((s, b) => s + b.count, 0);
  const total = blocks.reduce((s, b) => s + b.count, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold">Здоровье данных</h1>
        <p className="text-sm text-gray-500 mt-1">
          Что в оплатах выглядит подозрительно и что стоит проверить. Страница только показывает,
          ничего не меняет.
        </p>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {WINDOWS.map((d) => (
          <Link
            key={d}
            href={`/admin/health?days=${d}`}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              d === days
                ? "bg-acid-400/10 text-acid-400 border-acid-400/40 font-semibold"
                : "border-dark-600 text-gray-400"
            }`}
          >
            {d} дней
          </Link>
        ))}
      </div>

      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 space-y-3">
        {total === 0 ? (
          <div className="flex items-center gap-2 text-sm">
            <Icon name="check" className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Всё чисто. За последние {days} дней ничего подозрительного не нашли.</span>
          </div>
        ) : (
          <div className="text-sm text-gray-400">
            {attention > 0 ? `Есть что проверить: ${attention}. ` : "Срочного нет. "}
            Откройте нужный блок ниже.
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {blocks.map((b) => (
            <a
              key={b.key}
              href={`#${b.key}`}
              className={`text-xs rounded-full px-2.5 py-1 border ${
                b.count > 0 && b.alert
                  ? "text-[#C4593B] border-[#C4593B]/50 bg-[#C4593B]/10 font-semibold"
                  : b.count > 0
                  ? "text-gray-300 border-dark-500 bg-white/5"
                  : "text-gray-500 border-dark-600"
              }`}
            >
              {b.title}: {b.count}
            </a>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {blocks.map((b) => (
          <details
            key={b.key}
            id={b.key}
            className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden"
          >
            <summary className="p-4 flex items-center justify-between gap-3 cursor-pointer list-none">
              <span className="font-semibold text-sm min-w-0 break-words">{b.title}</span>
              <span
                className={`text-xs font-bold rounded-full min-w-[24px] h-6 px-2 flex items-center justify-center shrink-0 ${
                  b.count > 0 && b.alert
                    ? "bg-[#C4593B] text-white"
                    : b.count > 0
                    ? "bg-white/10 text-gray-200"
                    : "bg-white/5 text-gray-500"
                }`}
              >
                {b.count}
              </span>
            </summary>
            <div className="px-4 pb-4 space-y-2 border-t border-dark-600 pt-3">
              <p className="text-xs text-gray-500">{b.hint}</p>
              {b.count === 0 ? (
                <p className="text-sm text-gray-400">Всё чисто.</p>
              ) : (
                <>
                  {b.render()}
                  {b.count > LIST_LIMIT && (
                    <p className="text-xs text-gray-500">
                      Показаны первые {LIST_LIMIT} из {b.count}.
                    </p>
                  )}
                </>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
