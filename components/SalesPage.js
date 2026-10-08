import { cookies } from "next/headers";
import EmptyState from "@/components/EmptyState";
import SalesDashboard from "@/components/SalesDashboard";
import { getSalesAccess } from "@/lib/sales/access";
import { isConnected } from "@/lib/sales/departments";
import { hasGoogleKey } from "@/lib/sales/google";
import { getDepartmentMonths } from "@/lib/sales/data";
import { buildMonthView, monthList } from "@/lib/sales/metrics";
import { currentMonthKeyAlmaty } from "@/lib/timezone";

// Общая серверная часть раздела «Аналитика» для кабинета, админки и
// наблюдателей. Данные собираются здесь, в браузер уходят только цифры.
export default async function SalesPage({ searchParams = {}, basePath }) {
  const { me, departments, lead } = await getSalesAccess();

  if (!departments.length) {
    return (
      <EmptyState
        icon="chart"
        title="Аналитики для вашего отдела пока нет"
        hint="Раздел появится, когда таблицы оплат вашего отдела подключат к PactoCoins."
      />
    );
  }

  const remembered = cookies().get("sales_dept")?.value;
  const dept =
    departments.find((d) => d.id === searchParams.dept) ||
    departments.find((d) => d.id === remembered) ||
    departments[0];

  const deptOptions = departments.map((d) => ({ id: d.id, name: d.name }));
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
    />
  );
}
