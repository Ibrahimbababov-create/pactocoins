"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getReconcile, reconcileReminderText, REMIND_MIN_KZT } from "@/lib/reconcile";
import { getSheetSources, saveSheetSources, spreadsheetIdFrom, colToIndex } from "@/lib/sheetConfig";
import { notifyUser } from "@/lib/notifyUser";

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

// Сохранить ссылку на таблицу проекта и буквы колонок (дата, сумма).
export async function saveProjectSheet({ projectId, project, link, dateCol, amountCol }) {
  const viewer = await reconcileViewer();
  if (!viewer) return { error: "Нет доступа" };
  if (viewer.projectIds && !viewer.projectIds.includes(projectId)) {
    return { error: "Это не твой проект" };
  }

  const spreadsheetId = spreadsheetIdFrom(link);
  if (!spreadsheetId) return { error: "Не похоже на ссылку на Google-таблицу" };
  const d = colToIndex(dateCol);
  const a = colToIndex(amountCol);
  if (d == null || a == null) return { error: "Колонки — буквами, например B и I" };

  const admin = createAdminClient();
  const { sources } = await getSheetSources(admin);
  const next = sources.filter((s) => s.projectId !== projectId);
  next.push({
    project: String(project || "").trim() || "Проект",
    projectId,
    spreadsheetId,
    dateCol: d,
    amountCol: a,
  });

  const res = await saveSheetSources(admin, next);
  if (res.error) return { error: res.error };
  revalidatePath("/admin/reconcile");
  return { ok: true };
}
