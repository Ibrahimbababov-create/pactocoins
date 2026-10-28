import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import EmptyState from "@/components/EmptyState";
import RatingHallTabs from "@/components/RatingHallTabs";
import Icon from "@/components/Icon";
import { effectiveRole, resolveViewer } from "@/lib/viewAs";
import { getHallOfFame, SHOW_COUNT_RECORDS, HISTORICAL_BEST_MONTH } from "@/lib/hallOfFame";
import { formatPaymentDay, monthRangeAlmaty } from "@/lib/timezone";
import { plural } from "@/lib/plural";

const ALLOWED_ROLES = ["mop", "rop", "mentor", "trainee"];

const kzt = (n) => `${(Number(n) || 0).toLocaleString("ru-RU")} ₸`;
const noon = (key) => `${key}T12:00:00+05:00`;

function Record({ icon, title, rec, value, when, note }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-dark-800 border border-dark-700 p-4">
      <span className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-acid-400/10 text-acid-400">
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500">{title}</p>
        <p className="font-display font-bold text-lg truncate">{value}</p>
        <p className="text-sm text-gray-400 truncate">
          {rec.name}
          {" · "}{when}
        </p>
        {note && <p className="text-xs text-gray-500 truncate">{note}</p>}
      </div>
    </div>
  );
}

export default async function HallPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { viewId, watching } = await resolveViewer(supabase, user.id);
  const { data: profile } = await supabase
    .from("users")
    .select("role, is_guest")
    .eq("id", viewId)
    .single();
  const realRole = watching ? profile?.role : effectiveRole(profile?.role);

  if (profile?.is_guest || !ALLOWED_ROLES.includes(realRole)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-display font-bold">Зал славы</h1>
        <EmptyState
          icon="trophy"
          title="Раздел для сотрудников"
          hint="Зал славы виден тем, кто работает с выручкой: менеджерам, РОПам, наставникам и стажёрам."
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

  let hall = null;
  try {
    hall = await getHallOfFame();
  } catch (e) {
    console.error("[hall]", e);
  }

  if (!hall || !hall.bestDay) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-display font-bold">Рейтинг</h1>
        <RatingHallTabs active="hall" />
        <EmptyState
          icon="trophy"
          title="Рекордов пока нет"
          hint="Они появятся, как только в компании будут подтверждённые оплаты."
        />
      </div>
    );
  }

  const leader = hall.leader;
  const record = hall.bestMonth;
  const gap = leader ? record.value - leader.value : null;
  const monthLabel = monthRangeAlmaty(hall.monthKey).label;
  const progress = leader && record.value > 0 ? Math.min(100, Math.round((leader.value / record.value) * 100)) : 0;

  const medals = ["1", "2", "3"];
  const company = hall.companyMonth;
  const historicalPct = Math.floor(((hall.companyNow ?? 0) / HISTORICAL_BEST_MONTH.amountKzt) * 100);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold">Рейтинг</h1>
        <p className="text-sm text-gray-500 mt-1">Рекорды компании по подтверждённой выручке</p>
      </div>
      <RatingHallTabs active="hall" />

      <div className="rounded-3xl border border-acid-400/30 bg-gradient-to-br from-acid-400/15 via-dark-800 to-dark-800 p-5">
        <p className="text-xs text-gray-400">Рекорд месяца сейчас, {monthLabel}</p>
        {leader ? (
          <>
            <p className="mt-2 font-display font-bold text-xl">{leader.name}</p>
            <p className="font-display font-bold text-2xl text-acid-400">{kzt(leader.value)}</p>
            <div className="mt-3 h-2 rounded-full bg-dark-700 overflow-hidden">
              <div className="h-full rounded-full bg-acid-400" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-sm text-gray-300">
              {gap > 0
                ? `До рекорда компании ${kzt(gap)}. Его поставил(а) ${record.name}`
                : "Рекорд месяца побит! Это новый лучший месяц компании"}
            </p>
          </>
        ) : (
          <p className="mt-2 text-gray-300">
            В этом месяце подтверждённых оплат пока нет. Рекорд для атаки: {kzt(record.value)}, его поставил(а) {record.name}.
          </p>
        )}
      </div>

      <Record
        icon="fire"
        title="Лучший день"
        rec={hall.bestDay}
        value={kzt(hall.bestDay.value)}
        when={formatPaymentDay(noon(hall.bestDay.when))}
      />
      <Record
        icon="chart"
        title="Лучшая неделя"
        rec={hall.bestWeek}
        value={kzt(hall.bestWeek.value)}
        when={`с ${formatPaymentDay(noon(hall.bestWeek.when))} по ${formatPaymentDay(noon(hall.bestWeek.weekEnd))}`}
      />
      <Record
        icon="award"
        title="Лучший месяц"
        rec={hall.bestMonth}
        value={kzt(hall.bestMonth.value)}
        when={hall.bestMonth.manual ? hall.bestMonth.label : monthRangeAlmaty(hall.bestMonth.when).label}
      />
      <Record
        icon="coin"
        title="Самая большая оплата"
        rec={hall.bestPayment}
        value={kzt(hall.bestPayment.value)}
        when={formatPaymentDay(hall.bestPayment.at)}
      />
      {SHOW_COUNT_RECORDS && hall.mostDeals && (
        <Record
          icon="receipt"
          title="Больше всего оплат за день"
          rec={hall.mostDeals}
          value={`${hall.mostDeals.value} ${plural(hall.mostDeals.value, "оплата", "оплаты", "оплат")}`}
          when={formatPaymentDay(noon(hall.mostDeals.when))}
          note="без мастер-классов и предоплат"
        />
      )}
      {SHOW_COUNT_RECORDS && hall.mostPayMonth && (
        <Record
          icon="receipt"
          title="Больше всего оплат за месяц"
          rec={hall.mostPayMonth}
          value={`${hall.mostPayMonth.value} ${plural(hall.mostPayMonth.value, "оплата", "оплаты", "оплат")}`}
          when={monthRangeAlmaty(hall.mostPayMonth.when).label}
          note="без мастер-классов и предоплат"
        />
      )}
      {hall.fastest && (
        <Record
          icon="clock"
          title="Самый ранний миллион за месяц"
          rec={hall.fastest}
          value={`${hall.fastest.dom}-го числа`}
          when={`${formatPaymentDay(noon(hall.fastest.when))}, ${monthRangeAlmaty(hall.fastest.monthKey).label}`}
        />
      )}

      {hall.topDays?.length > 0 && (
        <div className="rounded-2xl bg-dark-800 border border-dark-700 p-4">
          <p className="text-xs text-gray-500">Лучшие дни компании, все вместе</p>
          <ul className="mt-2 space-y-2">
            {hall.topDays.map((d, i) => (
              <li key={d.when} className="flex items-center gap-3">
                <span className="flex items-center justify-center w-7 h-7 shrink-0 rounded-lg bg-acid-400/10 text-acid-400 font-display font-bold text-sm">
                  {medals[i]}
                </span>
                <span className="flex-1 text-sm text-gray-400">{formatPaymentDay(noon(d.when))}</span>
                <span className="font-display font-bold">{kzt(d.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {company && (
        <div className="rounded-2xl bg-dark-800 border border-dark-700 p-4">
          <p className="text-xs text-gray-500">Лучший месяц за всю историю компании</p>
          <p className="font-display font-bold text-lg">{kzt(HISTORICAL_BEST_MONTH.amountKzt)}</p>
          <p className="text-sm text-gray-400">{HISTORICAL_BEST_MONTH.label} (по данным таблицы)</p>
          <div className="mt-3 pt-3 border-t border-dark-700">
            <p className="text-sm text-gray-300">
              Сейчас идёт: {monthLabel}, {kzt(hall.companyNow ?? 0)}, это {historicalPct}% от рекорда
            </p>
            <div className="mt-2 h-2 rounded-full bg-dark-700 overflow-hidden">
              <div className="h-full rounded-full bg-acid-400" style={{ width: `${Math.min(100, historicalPct)}%` }} />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Сумма в PactoCoins считается по подтверждённым оплатам, а оборот клиентов в таблице может считаться иначе.
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Рекорд в PactoCoins: {monthRangeAlmaty(company.when).label}, {kzt(company.value)}
            </p>
          </div>
          {hall.monthTop?.length > 0 && (
            <ul className="mt-3 pt-3 border-t border-dark-700 space-y-1.5">
              {hall.monthTop.map((p, i) => (
                <li key={p.userId} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-gray-500">{i + 1}</span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="font-semibold text-acid-400">{kzt(p.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
