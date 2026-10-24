// Простая транслитерация кириллицы в латиницу — нужна, чтобы поиск по
// сотрудникам находил "Sula" по запросу "Сула" и наоборот не ломался,
// если у кого-то имя набрано латиницей, а ищут на русском.
const CYRILLIC_TO_LATIN = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  // казахские буквы — имён с ними у нас хватает
  ә: "a", ғ: "g", қ: "k", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
};

export function translitToLatin(str) {
  return String(str ?? "")
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

// Один звук пишут по-разному: Vitaly и Vitaliy, Shamil и Шамиль,
// Abdrakhim и Abdrahim. Здесь написание огрубляется до общего вида,
// чтобы такие пары считались одним именем.
function fuzzyKey(str) {
  return normalizeForSearch(str)
    .replace(/kh/g, "h")
    .replace(/ts/g, "c")
    .replace(/ck/g, "k")
    .replace(/x/g, "ks")
    .replace(/w/g, "v")
    .replace(/q/g, "k")
    .replace(/j/g, "zh")
    .replace(/iy|yi|ij/g, "i")
    .replace(/ye|yo/g, "e")
    .replace(/y/g, "i");
}

// Совпадает ли имя с тем, что набрали в поиске. Пустой запрос подходит всем.
export function matchesName(name, query) {
  const q = String(query ?? "").trim();
  if (!q) return true;
  const n = String(name ?? "");
  if (n.toLowerCase().includes(q.toLowerCase())) return true;
  const key = fuzzyKey(q);
  return key.length > 0 && fuzzyKey(n).includes(key);
}
