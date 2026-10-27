import { NextResponse } from "next/server";
import { getSalesAccess } from "@/lib/sales/access";
import { getDepartmentMonths } from "@/lib/sales/data";
import { hasAmo, getRaw, getLoss } from "@/lib/sales/amo";
import { buildTeamView, buildLossView } from "@/lib/sales/team";
import { mkey } from "@/lib/sales/metrics";
import { currentMonthKeyAlmaty } from "@/lib/timezone";

// Данные amoCRM для раздела «Аналитика»:
//   ?dept=…&period=today|yesterday|week — «Работа команды» (РОП и руководство)
//   ?dept=…&period=quota                — «Квота на сегодня» (все, кто видит отдел)
//   ?dept=…&period=loss&month=YYYY-MM   — причины отказов (РОП и руководство)
// amo отвечает медленно (тысячи событий), поэтому отдельным запросом, а не
// при открытии страницы; результат запоминается на 5–30 минут.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// менеджеры отдела по таблицам: последние два месяца, продажи и план
function peopleOf(months) {
  const keys = Object.keys(months).sort().slice(-2);
  const set = new Set();
  keys.forEach((k) => {
    const m = months[k];
    [...m.deals, ...(m.ints || [])].forEach((d) => set.add(d.m));
    Object.keys(m.plan || {}).forEach((n) => set.add(n));
  });
  return [...set].filter((n) => /[a-zа-яё]/i.test(n) && !/автооплата/i.test(n));
}

// квота на менеджера: лучший результат без ПО за прошлый месяц / 40% / 22 дня
function quotaOf(months) {
  const cur = currentMonthKeyAlmaty();
  const prev = Object.keys(months).sort().filter((k) => k < cur).pop();
  if (!prev) return { q: 1, best: null };
  const m = months[prev];
  const by = {};
  m.deals.forEach((d) => {
    if (!d.x && !d.po) by[d.m] = (by[d.m] || 0) + 1;
  });
  const planned = Object.keys(m.plan || {});
  const best = Math.max(0, ...planned.map((n) => by[n] || 0), ...(planned.length ? [] : Object.values(by)));
  return { q: Math.max(1, Math.round((best / 0.4 / 22) * 10) / 10), best };
}

export async function GET(request) {
  const url = new URL(request.url);
  const deptId = url.searchParams.get("dept");
  const period = url.searchParams.get("period") || "today";

  const { departments, lead } = await getSalesAccess();
  const dept = departments.find((d) => d.id === deptId);
  if (!dept) return NextResponse.json({ error: "Нет доступа к этому отделу" }, { status: 403 });
  if (period !== "quota" && !lead) return NextResponse.json({ error: "Только для РОПа и руководства" }, { status: 403 });
  if (!hasAmo(dept)) return NextResponse.json({ error: "amoCRM этого отдела ещё не подключена" }, { status: 404 });

  try {
    const data = await getDepartmentMonths(dept).catch(() => ({ months: {} }));
    // + менеджеры, которых вручную отнесли к отделу (их может не быть в плане)
    const manual = Object.entries(dept.managerDivisions || {})
      .filter(([, div]) => !dept.division || div === dept.division)
      .map(([n]) => n);
    // у отдела внутри общей таблицы — его менеджеры по последней продаже
    const people = data.members?.length
      ? [...new Set([...data.members, ...manual])]
      : [...new Set([...peopleOf(data.months || {}), ...manual])];
    const opts = { people, aliases: dept.amoAliases, lead };

    if (period === "loss") {
      const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") || "") ? url.searchParams.get("month") : currentMonthKeyAlmaty();
      return NextResponse.json(buildLossView(await getLoss(dept.amo, month), opts));
    }

    const raw = await getRaw(dept.amo, period === "quota" ? "today" : period);
    const view = buildTeamView(raw, opts);

    if (period === "quota") {
      const { q, best } = quotaOf(data.months || {});
      const planned = Object.keys(data.months?.[currentMonthKeyAlmaty()]?.plan || {});
      const names = planned.length ? planned : people;
      const inv = Object.fromEntries(Object.entries(view.invoices).map(([k, v]) => [mkey(k), v]));
      return NextResponse.json({
        q,
        best,
        managers: names.map((n) => ({ name: n, inv: inv[mkey(n)] || 0 })),
      });
    }
    return NextResponse.json(view);
  } catch (e) {
    console.error("sales team", dept.id, period, e.message);
    return NextResponse.json({ error: "amoCRM не ответила: " + e.message }, { status: 502 });
  }
}
