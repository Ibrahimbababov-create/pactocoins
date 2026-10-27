import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import { effectiveRole, resolveViewer } from "@/lib/viewAs";
import { getMonthRecap, prevMonthKey } from "@/lib/monthRecap";
import { currentMonthKeyAlmaty, formatPaymentDay } from "@/lib/timezone";
import { plural } from "@/lib/plural";

const ALLOWED_ROLES = ["mop", "rop", "mentor", "trainee"];
const MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

const kzt = (n) => `${(Number(n) || 0).toLocaleString("ru-RU")} ₸`;

function shiftMonth(key, back) {
  let k = key;
  for (let i = 0; i < back; i++) k = prevMonthKey(k);
  return k;
}

function monthChip(key) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl bg-dark-900/60 border border-dark-700 p-3.5 min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 font-display font-bold text-lg truncate">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500 truncate">{hint}</p>}
    </div>
  );
}

export default async function RecapPage({ searchParams }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { viewId, watching } = await resolveViewer(supabase, user.id);
  const { data: profile } = await supabase
    .from("users")
    .select("name, role, is_guest")
    .eq("id", viewId)
    .single();
  const role = effectiveRole(watching ? "admin" : profile?.role);
  const realRole = watching ? profile?.role : role;

  if (profile?.is_guest || !ALLOWED_ROLES.includes(realRole)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-display font-bold">Итог месяца</h1>
        <EmptyState
          icon="award"
          title="Раздел для сотрудников"
          hint="Итог месяца есть у менеджеров, РОПов, наставников и стажёров: у тех, кто записывает выручку."
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

  const nowKey = currentMonthKeyAlmaty();
  const lastKey = prevMonthKey(nowKey);
  const options = [nowKey, lastKey, shiftMonth(nowKey, 2), shiftMonth(nowKey, 3)];
  const asked = searchParams?.m;
  const monthKey = options.includes(asked) ? asked : lastKey;
  const isCurrent = monthKey === nowKey;

  const recap = await getMonthRecap(supabase, viewId, monthKey);

  const chips = (
    <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
      {options.map((key) => (
        <Link
          key={key}
          href={`/mop/recap?m=${key}`}
          replace
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm border transition ${
            key === monthKey
              ? "bg-acid-400 text-black border-acid-400 font-semibold"
              : "bg-dark-800 text-gray-400 border-dark-700 active:bg-dark-700"
          }`}
        >
          {monthChip(key)}
        </Link>
      ))}
    </div>
  );

  if (recap.deals === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-display font-bold">Итог месяца</h1>
        {chips}
        <EmptyState
          icon="receipt"
          title={`За ${recap.label} подтверждённых оплат нет`}
          hint={
            isCurrent
              ? "Как только появится первая подтверждённая оплата, здесь соберётся твой итог."
              : "Выбери другой месяц наверху или запиши новую выручку на главной."
          }
        />
      </div>
    );
  }

  const pct = recap.changePct;
  let compare;
  if (pct == null) {
    compare = "В прошлом месяце оплат не было, так что это новая точка отсчёта";
  } else if (pct === 0) {
    compare = "Столько же, сколько в прошлом месяце";
  } else {
    compare = `${pct > 0 ? "+" : "-"}${Math.abs(pct)}% к прошлому месяцу`;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display font-bold">Итог месяца</h1>
      {chips}

      <div className="relative overflow-hidden rounded-3xl border border-acid-400/30 bg-gradient-to-br from-acid-400/15 via-dark-800 to-dark-800 p-5">
        <div
          className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-acid-400/10"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-acid-400">
            <Icon name="award" className="w-5 h-5" />
            <span className="text-sm font-semibold">PactoCoins</span>
          </div>

          <p className="mt-5 text-gray-400 text-sm">{profile?.name}</p>
          <p className="font-display font-bold text-xl first-letter:uppercase">
            {recap.label}
            {isCurrent ? ", пока идёт" : ""}
          </p>

          <p className="mt-6 text-xs text-gray-500">Подтверждённая выручка</p>
          <p className="mt-1 font-display font-bold text-[34px] leading-tight text-acid-400 break-words">
            {kzt(recap.total)}
          </p>
          <p className="mt-2 text-sm text-gray-300">
            {recap.deals} {plural(recap.deals, "оплата", "оплаты", "оплат")}.{" "}
            {compare}
          </p>

          {recap.place && (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-acid-400/10 border border-acid-400/30 px-4 py-3">
              <Icon name="trophy" className="w-7 h-7 text-acid-400 shrink-0" />
              <div>
                <p className="font-display font-bold text-lg leading-tight">
                  {recap.place} место из {recap.ranked}
                </p>
                <p className="text-xs text-gray-400">в рейтинге месяца</p>
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            {recap.bestDay && (
              <Stat
                label="Лучший день"
                value={kzt(recap.bestDay.value)}
                hint={formatPaymentDay(recap.bestDay.at)}
              />
            )}
            {recap.bestPayment && (
              <Stat
                label="Лучшая оплата"
                value={kzt(recap.bestPayment.amount)}
                hint={formatPaymentDay(recap.bestPayment.at)}
              />
            )}
            <Stat
              label="Коинов за выручку"
              value={`+${recap.coins.toLocaleString("ru-RU")}`}
              hint="без бонусов и колеса"
            />
            <Stat
              label="Прошлый месяц"
              value={recap.prevTotal > 0 ? kzt(recap.prevTotal) : "нет оплат"}
            />
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-500 text-center px-4">
        Сделай скриншот и покажи команде. Суммы здесь только твои.
      </p>
    </div>
  );
}
