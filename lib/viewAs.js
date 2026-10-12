import { cookies } from "next/headers";

export const VIEW_AS_COOKIE = "pc_view_as";
export const VIEW_USER_COOKIE = "pc_view_user";

// Роли, глазами которых админ может посмотреть кабинет. Админа в списке
// нет: смотреть «как админ» — это просто выйти из просмотра.
const VIEWABLE = ["mop", "rop", "mentor", "trainee", "observer"];

export function isViewableRole(role) {
  return VIEWABLE.includes(role);
}

// Что лежит в куке. Саму куку ставит действие setViewAs.
export function viewAsRole() {
  const value = cookies().get(VIEW_AS_COOKIE)?.value;
  return isViewableRole(value) ? value : null;
}

// Чьими глазами смотрим. Роль отвечает на «как выглядит кабинет РОПа»,
// а это — на «что видит именно Sula»: его команда, его стажёры. Без этого
// админ попадал в пустой экран, потому что своей команды у него нет.
export function viewAsUserId() {
  const value = cookies().get(VIEW_USER_COOKIE)?.value;
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

// Чей кабинет показываем. Для всех, кроме админа в режиме просмотра, —
// свой собственный.
export function effectiveUserId(realRole, realUserId) {
  if (realRole !== "admin") return realUserId;
  return viewAsUserId() ?? realUserId;
}

// Роль, по которой рисуем экран. Подменяется ТОЛЬКО вид: серверные
// действия и проверки прав по-прежнему смотрят на настоящую роль из базы,
// иначе «посмотреть глазами стажёра» означало бы потерять права админа.
export function effectiveRole(realRole) {
  if (realRole !== "admin") return realRole;
  return viewAsRole() ?? realRole;
}
