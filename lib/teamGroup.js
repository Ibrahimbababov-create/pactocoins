import { getChatMemberStatus } from "@/lib/telegramBot";

// Chat id рабочей группы. Рассылки уходят ТОЛЬКО тем, кто реально в ней
// состоит — чтобы случайные люди, открывшие бота из своей телеги, ничего
// не получали. Можно переопределить переменной TELEGRAM_TEAM_CHAT_ID.
export const TEAM_CHAT_ID =
  process.env.TELEGRAM_TEAM_CHAT_ID || "-1003065195919";

const IN_GROUP = new Set([
  "creator",
  "administrator",
  "member",
  "restricted",
]);

// Из набора telegram_id оставляет только тех, кто состоит в рабочей группе.
// Проверяем через Telegram getChatMember пачками. Возвращает Set строк.
export async function keepGroupMembers(telegramIds) {
  const ids = [
    ...new Set(
      (telegramIds ?? [])
        .filter((x) => x !== null && x !== undefined)
        .map(String)
    ),
  ];

  const keep = new Set();
  const CHUNK = 12;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = ids.slice(i, i + CHUNK);
    const results = await Promise.all(
      batch.map(async (id) => {
        const status = await getChatMemberStatus(TEAM_CHAT_ID, id);
        return [id, IN_GROUP.has(status)];
      })
    );
    for (const [id, ok] of results) if (ok) keep.add(id);
  }

  return keep;
}

// Один пользователь — состоит ли в группе.
export async function isTeamMember(telegramId) {
  if (telegramId == null) return false;
  const keep = await keepGroupMembers([telegramId]);
  return keep.has(String(telegramId));
}
