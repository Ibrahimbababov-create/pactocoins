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

const fmt = (n) => `${Math.round(n).toLocaleString("ru-RU")} ₸`;
const FOOTER =
  "\n\n<i>Считается по оплатам, записанным и подтверждённым в PactoCoins.</i>";

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

const MEDALS = ["🥇", "🥈", "🥉"];
const place = (i) => MEDALS[i] ?? `${i + 1}.`;

function managerLines(rows) {
  return rows
    .map(
      (r, i) =>
        `${place(i)} ${escapeHtml(r.name)} <i>[${escapeHtml(r.project)}]</i> — <b>${fmt(r.total)}</b>`
    )
    .join("\n");
}

function teamLines(rows) {
  const map = new Map();
  for (const r of rows) {
    const t = map.get(r.project) ?? { total: 0, people: 0 };
    t.total += r.total;
    t.people += 1;
    map.set(r.project, t);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, t], i) => `${place(i)} ${escapeHtml(name)} — <b>${fmt(t.total)}</b>`)
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

  if (!rows.length) {
    return (
      (isToday ? "Сегодня подтверждённых оплат пока нет." : `За ${range.label} подтверждённых оплат пока нет.`) +
      FOOTER
    );
  }

  if (cmd === "/today") {
    return `💰 <b>Оплаты за сегодня</b>\n\n${managerLines(rows)}\n\nИтого: <b>${fmt(total(rows))}</b>${FOOTER}`;
  }
  if (cmd === "/todayteam") {
    return `💰 <b>Оплаты за сегодня по командам</b>\n\n${teamLines(rows)}\n\nИтого: <b>${fmt(total(rows))}</b>${FOOTER}`;
  }
  if (cmd === "/topteam") {
    return `🏆 <b>Топ команд · ${range.label}</b>\n\n${teamLines(rows)}\n\nИтого: <b>${fmt(total(rows))}</b>${FOOTER}`;
  }
  const list = cmd === "/top5" ? rows.slice(0, 5) : rows;
  const title = cmd === "/top5" ? "Топ-5 менеджеров" : "Все менеджеры";
  return `🏆 <b>${title} · ${range.label}</b>\n\n${managerLines(list)}${FOOTER}`;
}
