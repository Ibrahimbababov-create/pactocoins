// Отделы продаж для раздела «Аналитика». Один отдел = один проект в PactoCoins.
//
// Откуда брать таблицы оплат (достаточно одного):
//   folderId  — id папки на Google Диске (из ссылки .../folders/<id>), в которую
//               РОП складывает таблицы «Оплаты <месяц>» и «Большая таблица <месяц>»
//               и открывает её сервисному аккаунту на чтение;
//   nameQuery — поиск по названиям среди таблиц, открытых сервисному аккаунту.
// Ни того ни другого — отдел показывается как «ещё не подключён».
//
// project — название проекта в PactoCoins (Админка → Люди → Проекты). По нему
// понимаем, кто из сотрудников и РОПов относится к отделу.

export const DEPARTMENTS = [
  {
    id: "arman",
    name: "ОП Армана",
    project: "Арман",
    folderId: null,
    nameQuery:
      "name contains 'Арман' and (name contains 'Оплат' or name contains 'Большая таблица')",
  },
  {
    id: "sholpan",
    name: "ОП Шолпан",
    project: "Шолпан",
    folderId: null,
    nameQuery: null,
  },
];

export function isConnected(dept) {
  return !!(dept && (dept.folderId || dept.nameQuery));
}

export function findDepartment(id) {
  return DEPARTMENTS.find((d) => d.id === id) || null;
}

const norm = (s) => String(s || "").trim().toLowerCase();

// Отдел по названию проекта из базы
export function departmentForProject(projectName) {
  const p = norm(projectName);
  if (!p) return null;
  return DEPARTMENTS.find((d) => p === norm(d.project) || p.includes(norm(d.project))) || null;
}
