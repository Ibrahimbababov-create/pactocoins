// Фишки колеса фортуны (supabase/chips.sql): начислить или списать одним
// SQL-запросом, с записью в журнал. Возвращает { ok, chips }.
export async function addChips(admin, userId, n, reason = null) {
  const delta = Math.round(Number(n));
  if (!userId || !Number.isFinite(delta) || delta === 0) return { ok: false };
  const { data, error } = await admin.rpc("add_chips", { uid: userId, n: delta, p_reason: reason });
  if (error) {
    console.error("[addChips]", error);
    return { ok: false };
  }
  return { ok: true, chips: data ?? null };
}
