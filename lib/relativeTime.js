// Короткое "сколько времени назад" по-русски: "только что", "5 мин",
// "2 ч", "вчера", "3 дн", а дальше — дата. Для лёгких лент, без библиотек.
export function relativeTime(input) {
  const then = input instanceof Date ? input : new Date(input);
  const diffMs = Date.now() - then.getTime();
  const sec = Math.round(diffMs / 1000);

  if (sec < 45) return "только что";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн назад`;

  return then.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
