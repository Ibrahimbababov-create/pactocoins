import { cookies } from "next/headers";

export const VIEW_AS_COOKIE = "pc_view_as";

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

// Роль, по которой рисуем экран. Подменяется ТОЛЬКО вид: серверные
// действия и проверки прав по-прежнему смотрят на настоящую роль из базы,
// иначе «посмотреть глазами стажёра» означало бы потерять права админа.
export function effectiveRole(realRole) {
  if (realRole !== "admin") return realRole;
  return viewAsRole() ?? realRole;
}
