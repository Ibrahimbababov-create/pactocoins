// Простая транслитерация кириллицы в латиницу — нужна, чтобы поиск по
// сотрудникам находил "Sula" по запросу "Сула" и наоборот не ломался,
// если у кого-то имя набрано латиницей, а ищут на русском.
const CYRILLIC_TO_LATIN = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function translitToLatin(str) {
  return String(str)
    .toLowerCase()
    .split("")
    .map((ch) => CYRILLIC_TO_LATIN[ch] ?? ch)
    .join("");
}

// Канонический вид для сравнения: транслит + только буквы/цифры,
// без пробелов и пунктуации.
export function normalizeForSearch(str) {
  return translitToLatin(str).replace(/[^a-z0-9]/g, "");
}
