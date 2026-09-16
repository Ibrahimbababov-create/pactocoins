import crypto from "crypto";

// Сколько живёт строка входа от Telegram. Мини-приложение выдаёт её заново
// при каждом запуске, так что сутки — с большим запасом.
const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60;

// Проверяет, что initData реально пришли от Telegram (а не подделаны)
export function validateTelegramInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");

    const pairs = [...params.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const computedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (computedHash !== hash) return null;

    // Подпись верна — но она верна вечно. Telegram кладёт в initData время
    // выдачи; если строка старше суток, считаем её протухшей. Иначе один раз
    // утёкшая строка (скрин, лог, отладка) остаётся вечным ключом от аккаунта.
    const authDate = Number(params.get("auth_date"));
    if (!Number.isFinite(authDate)) return null;
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (ageSeconds > MAX_INIT_DATA_AGE_SECONDS) return null;

    const userStr = params.get("user");
    if (!userStr) return null;

    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// Пароль всегда один и тот же для конкретного telegram_id, но никогда не хранится
export function derivePassword(telegramId, botToken) {
  return crypto
    .createHmac("sha256", botToken)
    .update(String(telegramId))
    .digest("hex");
}
