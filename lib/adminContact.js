// Кнопка «написать» в уведомлении сотруднику. Человек получает «покупка
// одобрена» и обычно хочет уточнить, когда забирать: без кнопки он идёт
// искать по списку контактов.
//
// Ведём всегда к владельцу, то есть к самому первому заведённому админу
// с привязанным телеграмом. Решение может принять кто угодно из админов,
// но отвечает за выдачу один человек, и писать нужно ему.
export async function decisionContact(admin) {
  const { data: owner } = await admin
    .from("users")
    .select("name, telegram_id")
    .eq("role", "admin")
    .eq("is_active", true)
    .not("telegram_id", "is", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!owner?.telegram_id) return undefined;

  return {
    inline_keyboard: [
      [
        {
          text: `✍️ Написать: ${owner.name ?? "админ"}`,
          url: `tg://user?id=${owner.telegram_id}`,
        },
      ],
    ],
  };
}
