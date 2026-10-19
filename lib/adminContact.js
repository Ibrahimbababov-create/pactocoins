// Кнопка «написать по этой покупке» в уведомлении сотруднику. Человек
// получает «покупка одобрена» и обычно хочет уточнить, когда забирать:
// без кнопки он идёт искать Ибрагима по списку контактов.
//
// Ведём к тому, кто принял решение. Если он решал из админки и телеграма
// у него нет, берём первого админа с телеграмом.
export async function decisionContact(admin, actorTelegramId) {
  let person = null;

  if (actorTelegramId) {
    const { data } = await admin
      .from("users")
      .select("name, telegram_id")
      .eq("telegram_id", actorTelegramId)
      .maybeSingle();
    person = data ?? null;
  }

  if (!person?.telegram_id) {
    const { data } = await admin
      .from("users")
      .select("name, telegram_id")
      .eq("role", "admin")
      .eq("is_active", true)
      .not("telegram_id", "is", null)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    person = data ?? null;
  }

  if (!person?.telegram_id) return undefined;

  return {
    inline_keyboard: [
      [
        {
          text: `✍️ Написать: ${person.name ?? "админ"}`,
          url: `tg://user?id=${person.telegram_id}`,
        },
      ],
    ],
  };
}
