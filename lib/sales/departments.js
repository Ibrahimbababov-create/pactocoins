// Отделы продаж для раздела «Аналитика».
//
// Откуда брать таблицы оплат (достаточно одного):
//   folderId  — id папки на Google Диске (из ссылки .../folders/<id>), в которую
//               РОП складывает таблицы «Оплаты <месяц>» и «Большая таблица <месяц>»
//               и открывает её сервисному аккаунту на чтение;
//   nameQuery — поиск по названиям среди таблиц, открытых сервисному аккаунту;
//   spreadsheetIds — конкретные таблицы (id из ссылки .../d/<id>/edit). Удобно,
//               пока папки нет, но новые таблицы месяца придётся дописывать сюда.
// Ничего из этого — отдел показывается как «ещё не подключён».
//
// source   — общий источник: несколько отделов могут жить в одних таблицах,
//            тогда таблицы читаются один раз.
// division — значение колонки «Отдел» в таблице. Оплаты без этой колонки
//            (лист менеджера в «Оплатах») относятся к отделу менеджера —
//            по managerDivisions, а если там его нет — по последней его
//            продаже с указанным отделом.
// amo      — amoCRM отдела: адрес, имя переменной с токеном (значение только
//            в Vercel) и часть названия воронки отдела продаж. amoAliases —
//            «как в amo» → «как в таблице», если имена расходятся.
// color    — цвет команды в аналитике (R G B): Арман — зелёный, Шолпан —
//            синий, третья команда — красный (TEAM_COLORS.red).
// project  — название проекта в PactoCoins (Админка → Люди → Проекты). По нему
//            понимаем, кто из сотрудников и РОПов относится к отделу.

export const TEAM_COLORS = {
  green: { accent: "67 209 140", strong: "46 178 113" },
  blue: { accent: "92 148 245", strong: "64 120 222" },
  sky: { accent: "86 204 242", strong: "52 176 220" }, // второй отдел синей команды
  red: { accent: "240 115 131", strong: "214 84 104" },
};

const SHOLPAN = {
  source: "sholpan",
  color: TEAM_COLORS.blue,
  project: "Шолпан",
  folderId: null,
  nameQuery: null,
  spreadsheetIds: [
    "1TcqzsWu5OGJuEx6TJkLFo7Jo1Ali9Jibw-yRYnshdMY", // Отчет Адамант ПДД 2026
    "1tZSqex5cyJg_cOJ7Zsdjq20Y29LeFmlRO1DinyyYt38", // Оплаты Шолпан Октябрь
  ],
  // Оба отдела работают в одних воронках amo — делим по менеджерам
  amo: { domain: "adamantschool.amocrm.ru", tokenEnv: "AMO_TOKEN_SHOLPAN", pipeline: "ОП ОСНОВНАЯ" },
  amoAliases: { Анжелика: "Анджелика" },
  // Менеджеры, у которых ещё нет продаж с колонкой «Отдел» — куда их отнести
  managerDivisions: { Анджелика: "Отдел 1" },
  // РНП отдела (показатели по дням: лиды, звонки, счета) — пригодится для
  // экрана «Работа команды»; в расчёт выручки не идёт.
  rnpSpreadsheetId: "1rFy4NyxZPcpQKQ9MFLzN71THJo0I28Ytd63IjCTy7fQ",
};

export const DEPARTMENTS = [
  {
    id: "arman",
    name: "ОП Армана",
    project: "Арман",
    color: TEAM_COLORS.green,
    amo: { domain: "armantiktok.amocrm.ru", tokenEnv: "AMO_TOKEN_ARMAN", pipeline: "султан" },
    folderId: null,
    nameQuery:
      // Тот же поиск, что в дашборде arman-analytics (копии тоже берём —
      // одинаковые оплаты всё равно схлопываются в одну).
      "name contains 'Арман' and (name contains 'Оплат' or name contains 'Большая таблица')",
  },
  { ...SHOLPAN, id: "sholpan-1", name: "ОП Шолпан · Отдел 1", division: "Отдел 1" },
  { ...SHOLPAN, id: "sholpan-2", name: "ОП Шолпан · Отдел 2", division: "Отдел 2", color: TEAM_COLORS.sky },
];

export function isConnected(dept) {
  return !!(dept && (dept.folderId || dept.nameQuery || dept.spreadsheetIds?.length));
}

export function findDepartment(id) {
  return DEPARTMENTS.find((d) => d.id === id) || null;
}

const norm = (s) => String(s || "").trim().toLowerCase();

// Отделы по названию проекта из базы (у одного проекта их может быть несколько)
export function departmentsForProject(projectName) {
  const p = norm(projectName);
  if (!p) return [];
  return DEPARTMENTS.filter((d) => p === norm(d.project) || p.includes(norm(d.project)));
}
