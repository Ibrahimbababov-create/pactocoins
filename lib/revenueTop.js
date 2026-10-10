import {
  todayRangeAlmaty,
  monthRangeAlmaty,
  currentMonthKeyAlmaty,
} from "@/lib/timezone";

// /top5, /topall, /topteam, /today, /todayteam в Telegram — по выручке,
// которую ребята записали в PactoCoins и которую подтвердили. Раньше их
// считал старый sales-bot по Google-таблицам, и топ в группе расходился
// с рейтингом в приложении. Теперь источник один: rating_revenue.

function escapeHtml(s) {
  return String(s).replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])
  );
}


// Кто участвует. Для топа менеджеров — те же люди, что в рейтинге
// приложения (lib/ratingData.js). Для «сегодня» — все настоящие сотрудники:
// там важно, сколько денег зашло, а не кто с кем соревнуется.
async function loadRows(admin, range, { ratingOnly }) {
  // Проект берём отдельным запросом: users связан с projects двумя путями
  // (users.project_id и project_rops), и вложенный select projects(name)
  // база отвергала как неоднозначный — топ молча выходил пустым.
  let usersQuery = admin
    .from("users")
    .select("id, name, project_id")
    .eq("is_guest", false)
    .not("email", "like", "%.test@pactocoins.local");
  if (ratingOnly) usersQuery = usersQuery.in("role", ["mop", "observer"]);

  const [usersRes, revenueRes, projectsRes] = await Promise.all([
    usersQuery,
    admin.rpc("rating_revenue", { p_start: range.start, p_end: range.end }),
    admin.from("projects").select("id, name"),
  ]);
  // Ошибку не глотаем: иначе бот уверенно пишет «оплат нет».
  const failed = usersRes.error || revenueRes.error || projectsRes.error;
  if (failed) throw new Error(`[revenueTop] ${failed.message}`);

  const projectName = Object.fromEntries((projectsRes.data ?? []).map((p) => [p.id, p.name]));
  const byId = Object.fromEntries((usersRes.data ?? []).map((u) => [u.id, u]));
  return (revenueRes.data ?? [])
    .filter((r) => byId[r.user_id] && Number(r.total) > 0)
    .map((r) => ({
      name: byId[r.user_id].name,
      project: projectName[byId[r.user_id].project_id] ?? "Без проекта",
      total: Number(r.total),
      deals: Number(r.deals) || 0,
    }))
    .sort((a, b) => b.total - a.total);
}

// Оформление — как у старого бота продаж, который ребятам нравился:
// простой нумерованный список «1. Имя — 4 111 000», без жирного,
// проектов и приписок.
const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function managerLines(rows) {
  return rows.map((r, i) => `${i + 1}. ${escapeHtml(r.name.trim())} — ${num(r.total)}`).join("\n");
}

function teamLines(rows) {
  const map = new Map();
  for (const r of rows) map.set(r.project, (map.get(r.project) ?? 0) + r.total);
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, sum], i) => `${i + 1}. ${escapeHtml(name)} — ${num(sum)}`)
    .join("\n");
}

const total = (rows) => rows.reduce((s, r) => s + r.total, 0);

// cmd: /top5 | /topall | /topteam | /today | /todayteam
export async function renderRevenueCommand(admin, cmd) {
  const isToday = cmd === "/today" || cmd === "/todayteam";
  const range = isToday
    ? { ...todayRangeAlmaty(), label: "сегодня" }
    : monthRangeAlmaty(currentMonthKeyAlmaty());
  const rows = await loadRows(admin, range, { ratingOnly: !isToday });
  const month = cap(range.label);

  if (!rows.length) {
    return isToday ? "Сегодня оплат нет" : `За ${range.label} оплат пока нет`;
  }

  if (cmd === "/today") {
    return `Сегодня:\n\n${managerLines(rows)}\n\nИтого: ${num(total(rows))}`;
  }
  if (cmd === "/todayteam") {
    return `Сегодня по командам:\n\n${teamLines(rows)}\n\nИтого: ${num(total(rows))}`;
  }
  if (cmd === "/topteam") {
    return `Топ команд (${month}):\n\n${teamLines(rows)}\n\nИтого: ${num(total(rows))}`;
  }
  if (cmd === "/top5") {
    return `Топ 5 (${month}):\n\n${managerLines(rows.slice(0, 5))}`;
  }
  return `Все менеджеры (${month}):\n\n${managerLines(rows)}`;
}
