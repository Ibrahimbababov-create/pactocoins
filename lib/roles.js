// Один словарь ролей на весь проект. Раньше подписи собирались цепочками
// «если роп … иначе МОП» в каждом экране, и стоило добавить роль, как
// наставник превращался в МОПа. Добавляешь роль в базу — добавь строку тут.
export const ROLE_LABELS = {
  admin: "админ",
  rop: "РОП",
  mop: "МОП",
  mentor: "наставник",
  trainee: "стажёр",
  observer: "наблюдатель",
};

// Для заголовков и кнопок, где слово стоит первым.
export const ROLE_TITLES = {
  admin: "Админ",
  rop: "РОП",
  mop: "МОП",
  mentor: "Наставник",
  trainee: "Стажёр",
  observer: "Наблюдатель",
};

export function roleLabel(role) {
  return ROLE_LABELS[role] ?? role ?? "сотрудник";
}

export function roleTitle(role) {
  return ROLE_TITLES[role] ?? role ?? "Сотрудник";
}

// Куда ведёт роль: наблюдатель живёт в своём разделе, остальные в кабинете.
export function roleHome(role) {
  if (role === "observer") return "/observer";
  if (role === "admin") return "/admin";
  return "/mop";
}

// Кто работает внутри проекта. Наблюдатель смотрит со стороны, наставник
// ведёт стажёров из любых проектов, админ — не сотрудник проекта.
export const PROJECT_ROLES = ["rop", "mop", "trainee"];

export function worksInProject(role) {
  return PROJECT_ROLES.includes(role);
}
