"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getReconcile, reconcileReminderText, REMIND_MIN_KZT } from "@/lib/reconcile";
import {
  getSheetSources,
  saveSheetSources,
  spreadsheetIdFrom,
  colToIndex,
  upsertSource,
} from "@/lib/sheetConfig";
import { notifyUser } from "@/lib/notifyUser";
import { listSheetTabs, previewSource } from "@/lib/sheetsRevenue";
import { recentMonthKeysAlmaty } from "@/lib/timezone";

// Кто смотрит сверку. Админ — все проекты (projectIds = null). РОП — только
// свои проекты (project_rops): видит своих людей, меняет ссылку на таблицу
// своего проекта, напоминает своим.
export async function reconcileViewer() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role, is_active")
    .eq("id", user.id)
    .single();
  if (!profile || profile.is_active === false) return null;
  if (profile.role === "admin") return { id: user.id, role: "admin", projectIds: null };
  if (profile.role !== "rop") return null;

  const { data: links } = await admin.from("project_rops").select("project_id").eq("rop_id", user.id);
  return { id: user.id, role: "rop", projectIds: (links ?? []).map((l) => l.project_id) };
}

// Напомнить в личку тем, у кого в таблице больше, чем в PactoCoins.
// userIds пустой — всем с разницей. Цифры пересчитываем на сервере в
// момент отправки, а не берём с экрана.
export async function sendReconcileReminders(monthKey, userIds = []) {
  const viewer = await reconcileViewer();
  if (!viewer) return { error: "Нет доступа" };
  if (!/^\d{4}-\d{2}$/.test(String(monthKey))) return { error: "Неверный месяц" };

  const admin = createAdminClient();
  const data = await getReconcile(admin, monthKey, { projectIds: viewer.projectIds });
  if (!data.ok) return { error: "Таблицы не открылись, попробуй позже" };

  const only = new Set(userIds);
  const targets = data.rows.filter(
    (r) => r.user && r.user.hasTelegram && r.missing >= REMIND_MIN_KZT && (!only.size || only.has(r.user.id))
  );

  for (const r of targets) {
    await notifyUser(admin, r.user.id, reconcileReminderText(r, data.monthLabel));
  }
  return { sent: targets.length };
}

// Разобрать настройки из формы в источник. Ошибка — { error }.
// month — месяц, за который таблица: текущий или прошлый.
function buildSource({ projectId, project, month, link, layout, tab, nameCol, dateCol, amountCol, startRow }) {
  if (!recentMonthKeysAlmaty(2).some((m) => m.key === month)) return { error: "Неверный месяц" };
  const spreadsheetId = spreadsheetIdFrom(link);
  if (!spreadsheetId) return { error: "Не похоже на ссылку на Google-таблицу" };
  const isSheet = layout === "sheet";
  if (isSheet && !String(tab || "").trim()) return { error: "Выбери лист" };
  const a = colToIndex(amountCol);
  if (a == null) return { error: "Колонка суммы — буквой, например D" };
  const base = {
    project: String(project || "").trim() || "Проект",
    projectId,
    month,
    spreadsheetId,
    amountCol: a,
  };
  if (isSheet) {
    const n = colToIndex(nameCol);
    if (n == null) return { error: "Колонка имени — буквой, например A" };
    if (n === a) return { error: "Имя и сумма не могут быть в одной колонке" };
    return { source: { ...base, layout: "sheet", tab: String(tab).trim(), nameCol: n } };
  }
  const d = colToIndex(dateCol);
  if (d == null) return { error: "Колонка даты — буквой, например B" };
  const row = Math.max(1, Math.min(50, Number(startRow) || 3));
  return { source: { ...base, layout: "tabs", dateCol: d, startRow: row } };
}

async function viewerFor(projectId) {
  const viewer = await reconcileViewer();
  if (!viewer) return { error: "Нет доступа" };
  if (viewer.projectIds && !viewer.projectIds.includes(projectId)) {
    return { error: "Это не твой проект" };
  }
  return { viewer };
}

// Список листов таблицы — чтобы выбрать нужный, а не вспоминать название.
export async function listTabsForLink(projectId, link) {
  const v = await viewerFor(projectId);
  if (v.error) return v;
  const id = spreadsheetIdFrom(link);
  if (!id) return { error: "Не похоже на ссылку на Google-таблицу" };
  const res = await listSheetTabs(id);
  if (res.error) return { error: res.error[0].toUpperCase() + res.error.slice(1) };
  return { tabs: res.tabs };
}

// Проверить настройки: как сервер понял строки — до сохранения.
export async function previewProjectSheet(form) {
  const v = await viewerFor(form.projectId);
  if (v.error) return v;
  const built = buildSource(form);
  if (built.error) return built;
  return previewSource(built.source);
}

// Сохранить таблицу проекта.
export async function saveProjectSheet(form) {
  const v = await viewerFor(form.projectId);
  if (v.error) return v;
  const built = buildSource(form);
  if (built.error) return built;

  const admin = createAdminClient();
  const { sources } = await getSheetSources(admin);
  const res = await saveSheetSources(admin, upsertSource(sources, built.source));
  if (res.error) return { error: res.error };
  revalidatePath("/admin/reconcile");
  return { ok: true };
}
