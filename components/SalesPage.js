import { cookies } from "next/headers";
import EmptyState from "@/components/EmptyState";
import SalesDashboard from "@/components/SalesDashboard";
import { getSalesAccess } from "@/lib/sales/access";
import { isConnected } from "@/lib/sales/departments";
import { hasGoogleKey } from "@/lib/sales/google";
import { hasAmo } from "@/lib/sales/amo";
import { getDepartmentMonths } from "@/lib/sales/data";
import { buildMonthView, monthList } from "@/lib/sales/metrics";
import { currentMonthKeyAlmaty } from "@/lib/timezone";

// Общая серверная часть раздела «Аналитика» для кабинета, админки и
// наблюдателей. Данные собираются здесь, в браузер уходят только цифры.
export default async function SalesPage({ searchParams = {}, basePath }) {
  const { me, departments, lead, all } = await getSalesAccess();

  if (!departments.length) {
    return (
      <EmptyState
        icon="chart"
        title="Аналитики для вашего отдела пока нет"
        hint="Раздел появится, когда таблицы оплат вашего отдела подключат к PactoCoins."
      />
    );
  }

  // руководству (админ, наблюдатель) первым пунктом — «Все отделы», пульт
  const ownerMode = all && departments.length > 1;
  const remembered = cookies().get("sales_dept")?.value;
  const wanted = searchParams.dept || remembered || (ownerMode ? "all" : null);
  const deptOptions = [
    ...(ownerMode ? [{ id: "all", name: "Все отделы", color: null }] : []),
    ...departments.map((d) => ({ id: d.id, name: d.name, color: d.color || null })),
  ];

  if (ownerMode && wanted === "all") {
    if (!hasGoogleKey()) {
      return (
        <SalesDashboard basePath={basePath} departments={deptOptions} deptId="all" months={[]} view={null} lead={lead} meName={me?.name ?? null}
          notice={{ title: "Ключ Google ещё не добавлен", hint: "Без него таблицы оплат не читаются." }} />
      );
    }
    const loaded = await Promise.all(
      departments.filter(isConnected).map(async (d) => {
        try {
          return { d, data: await getDepartmentMonths(d) };
        } catch (e) {
          console.error("sales owner", d.id, e.message);
          return { d, data: null };
        }
      })
    );
    const keys = [...new Set(loaded.flatMap((x) => Object.keys(x.data?.months || {})))].sort().reverse();
    const current = currentMonthKeyAlmaty();
    const key = (searchParams.month && keys.includes(searchParams.month) && searchParams.month) || (keys.includes(current) ? current : keys[0]);
    const labelOf = Object.fromEntries(loaded.flatMap((x) => Object.values(x.data?.months || {}).map((m) => [m.key, m.label])));
    const teams = loaded.map(({ d, data }) => ({
      id: d.id,
      name: d.name,
      color: d.color,
      amo: hasAmo(d),
      view: data?.months?.[key] ? buildMonthView(data.months, key) : null,
    }));
    return (
      <SalesDashboard
        basePath={basePath}
        departments={deptOptions}
        deptId="all"
        months={keys.map((k) => ({ key: k, label: labelOf[k] }))}
        monthKey={key}
        view={null}
        lead={lead}
        meName={me?.name ?? null}
        notice={null}
        owner={{ teams, broken: teams.filter((t) => !t.view).map((t) => t.name) }}
      />
    );
  }

  const dept = departments.find((d) => d.id === wanted) || departments[0];
  const shell = (body) => (
    <SalesDashboard
      basePath={basePath}
      departments={deptOptions}
      deptId={dept.id}
      months={[]}
      view={null}
      lead={lead}
      meName={me?.name ?? null}
      notice={body}
    />
  );

  if (!hasGoogleKey()) {
    return shell({
      title: "Ключ Google ещё не добавлен",
      hint: "Ибрагим добавляет его в настройки Vercel — шаг 2 в чек-листе доступов.",
    });
  }
  if (!isConnected(dept)) {
    return shell({
      title: `${dept.name}: таблицы ещё не подключены`,
      hint: "РОП отдела открывает папку с таблицами оплат сервисному аккаунту — шаг 3 в чек-листе.",
    });
  }

  let data;
  try {
    data = await getDepartmentMonths(dept);
  } catch (e) {
    console.error("sales", dept.id, e.message);
    return shell({
      title: "Не получилось прочитать таблицы",
      hint: "Google не ответил или у сервисного аккаунта нет доступа. Попробуйте обновить страницу через минуту.",
    });
  }

  const months = monthList(data.months);
  if (!months.length && !data.fileCount) {
    return shell({
      title: "Таблицы отдела не найдены",
      hint: "Сервисному аккаунту ещё не открыли доступ к таблицам оплат (Поделиться → Читатель).",
    });
  }
  if (!months.length && data.failed?.length) {
    return shell({
      title: "Нет доступа к таблицам отдела",
      hint: `Не открылось таблиц: ${data.failed.length} из ${data.fileCount}. РОП открывает их сервисному аккаунту (Поделиться → Читатель).`,
    });
  }
  if (!months.length) {
    return shell({
      title: "В таблицах пока нет оплат",
      hint: `Найдено таблиц: ${data.fileCount}. Проверьте, что в них есть листы менеджеров с колонками «Дата продажи», «ФИО», «Сумма продажи».`,
    });
  }

  const current = currentMonthKeyAlmaty();
  const key =
    (searchParams.month && data.months[searchParams.month] && searchParams.month) ||
    (data.months[current] ? current : months[0].key);

  const view = buildMonthView(data.months, key, { withDeals: lead });

  return (
    <SalesDashboard
      basePath={basePath}
      departments={deptOptions}
      deptId={dept.id}
      months={months}
      view={view}
      lead={lead}
      meName={me?.name ?? null}
      notice={null}
      amo={hasAmo(dept)}
      issues={lead ? data.issues ?? [] : []}
      unassigned={lead ? data.unassigned ?? [] : []}
    />
  );
}
