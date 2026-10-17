// Выдать (или забрать, n < 0) крутки колеса одним SQL-запросом.
//
// Раньше крутки начислялись «прочитали число → записали +1»: два одобрения
// одновременно давали одну крутку вместо двух, а крутка, выпавшая на колесе,
// могла затереть только что потраченную. add_wheel_spins прибавляет прямо
// в базе и не опускает ниже нуля. Возвращает { ok, spins } либо { ok: false }.
export async function addSpins(admin, userId, n) {
  const delta = Math.round(Number(n));
  if (!userId || !Number.isFinite(delta) || delta === 0) return { ok: false };
  const { data, error } = await admin.rpc("add_wheel_spins", { uid: userId, n: delta });
  if (error) {
    console.error("[addSpins]", error);
    return { ok: false };
  }
  return { ok: true, spins: data ?? null };
}
