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
//            по последней его продаже с указанным отделом.
// project  — название проекта в PactoCoins (Админка → Люди → Проекты). По нему
//            понимаем, кто из сотрудников и РОПов относится к отделу.

const SHOLPAN = {
  source: "sholpan",
  project: "Шолпан",
  folderId: null,
  nameQuery: null,
  spreadsheetIds: [
    "1TcqzsWu5OGJuEx6TJkLFo7Jo1Ali9Jibw-yRYnshdMY", // Отчет Адамант ПДД 2026
    "1tZSqex5cyJg_cOJ7Zsdjq20Y29LeFmlRO1DinyyYt38", // Оплаты Шолпан Октябрь
  ],
  // РНП отдела (показатели по дням: лиды, звонки, счета) — пригодится для
  // экрана «Работа команды»; в расчёт выручки не идёт.
  rnpSpreadsheetId: "1rFy4NyxZPcpQKQ9MFLzN71THJo0I28Ytd63IjCTy7fQ",
};

export const DEPARTMENTS = [
  {
    id: "arman",
    name: "ОП Армана",
    project: "Арман",
    folderId: null,
    nameQuery:
      // «Копия …» не берём: иначе изменённые в копии строки посчитаются дважды
      "name contains 'Арман' and (name contains 'Оплат' or name contains 'Большая таблица') and not name contains 'Копия'",
  },
  { ...SHOLPAN, id: "sholpan-1", name: "ОП Шолпан · Отдел 1", division: "Отдел 1" },
  { ...SHOLPAN, id: "sholpan-2", name: "ОП Шолпан · Отдел 2", division: "Отдел 2" },
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
