import { notifyManyUsers } from "@/lib/notifyUser";

// Рассылаем про флеш-распродажу только когда она реально новая:
// у награды появилась скидка с будущим дедлайном, которой раньше не
// было (или дедлайн сдвинули на другое время). Обычные правки карточки
// (название, фото) рассылку не триггерят.
export async function announceFlashSaleIfNew(
  admin,
  { title, priceCoins, salePriceCoins, saleEndsAt, prevSaleEndsAt, isVariable }
) {
  if (isVariable) return;
  if (!saleEndsAt || !salePriceCoins) return;
  if (new Date(saleEndsAt).getTime() <= Date.now()) return;
  if (prevSaleEndsAt && new Date(prevSaleEndsAt).getTime() === new Date(saleEndsAt).getTime()) {
    return; // дедлайн не менялся — это не новая распродажа
  }

  const until = new Date(saleEndsAt).toLocaleString("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const wasPrice = priceCoins ? ` (обычно ${priceCoins})` : "";
  await notifyManyUsers(
    admin,
    `🔥 Флеш-распродажа: «${title}» за ${salePriceCoins} coins${wasPrice} — успей до ${until}`,
    "notify_shop"
  );
}
