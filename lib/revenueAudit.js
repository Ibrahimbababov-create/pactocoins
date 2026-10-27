// Журнал оплат (таблица revenue_audit, см. supabase/revenue_audit_log.sql).
//
// Строго «лучшая попытка»: любая ошибка (в том числе если таблицы ещё нет)
// гасится здесь и никогда не ломает основное действие. Вызывать ПОСЛЕ
// успешного шага, не меняя поток одобрения.

const ACTIONS = ["create", "approve", "reject", "edit", "delete", "cancel", "other"];
const SOURCES = ["web", "telegram", "system"];
const FIELDS = [
  "amount_kzt",
  "earned_at",
  "status",
  "client_name",
  "product_kind",
  "pay_kind",
  "credited_coins",
  "calculated_coins",
];

function cut(value, max) {
  if (value == null) return null;
  const s = String(value);
  return s.length > max ? s.slice(0, max) : s;
}

// Только нужные поля заявки, тексты обрезаем.
export function pickRevenueFields(row, only) {
  if (!row || typeof row !== "object") return null;
  const out = {};
  for (const key of only ?? FIELDS) {
    if (row[key] === undefined) continue;
    const v = row[key];
    out[key] = typeof v === "string" ? cut(v, 200) : v;
  }
  return out;
}

async function resolveName(admin, actorId) {
  if (!actorId) return null;
  try {
    const { data } = await admin.from("users").select("name").eq("id", actorId).maybeSingle();
    return data?.name ?? null;
  } catch {
    return null;
  }
}

function buildRow(e, actorName) {
  return {
    request_id: e.requestId ?? null,
    user_id: e.userId ?? null,
    actor_id: e.actorId ?? null,
    actor_name: cut(actorName ?? e.actorName, 120),
    source: SOURCES.includes(e.source) ? e.source : "web",
    action: ACTIONS.includes(e.action) ? e.action : "other",
    before: e.before ?? null,
    after: e.after ?? null,
    note: cut(e.note, 500),
  };
}

export async function logRevenueChange(admin, entry) {
  try {
    const name = entry.actorName ?? (await resolveName(admin, entry.actorId));
    await admin.from("revenue_audit").insert(buildRow(entry, name));
  } catch (e) {
    console.error("[revenueAudit]", e?.message ?? e);
  }
}

// Несколько записей одним запросом (например, при сбросе данных сотрудника).
export async function logRevenueChanges(admin, entries) {
  try {
    if (!entries?.length) return;
    const names = new Map();
    const rows = [];
    for (const e of entries.slice(0, 500)) {
      if (e.actorId && !names.has(e.actorId)) names.set(e.actorId, await resolveName(admin, e.actorId));
      rows.push(buildRow(e, e.actorName ?? names.get(e.actorId)));
    }
    await admin.from("revenue_audit").insert(rows);
  } catch (e) {
    console.error("[revenueAudit]", e?.message ?? e);
  }
}
