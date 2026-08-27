// Лента событий команды. Запись только с сервера через admin-клиент
// (RLS разрешает всем читать, но не писать). Ошибку глотаем — сбой
// записи в ленту не должен ронять покупку/одобрение/начисление.
// user_name денормализуем: RLS на users не даёт МОПу читать чужие
// строки, поэтому джойнить имя на чтении ленты нельзя.
export async function recordTeamEvent(admin, { userId, userName, kind, title, icon }) {
  try {
    await admin.from("team_events").insert({
      user_id: userId,
      user_name: userName ?? "Кто-то",
      kind,
      title,
      icon: icon ?? null,
    });
  } catch (err) {
    console.error("[teamEvents] insert failed:", err);
  }
}
