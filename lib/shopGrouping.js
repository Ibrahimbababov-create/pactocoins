// Раскладка наград по категориям для магазина (сотрудник и наблюдатель).
// Награда лежит в основной категории (rewards.category) и во всех
// дополнительных (rewards.extra_categories). Если колонки в базе ещё нет,
// extra_categories просто отсутствует и всё работает как раньше.
function sortKey(r) {
  const n = Number(r.sort_order);
  return Number.isFinite(n) ? n : 0;
}

function fixedPrice(r) {
  if (r.is_variable) return null;
  if (Array.isArray(r.variants) && r.variants.length > 0) {
    return Math.min(...r.variants.map((v) => Number(v.price_coins) || 0));
  }
  const p = Number(r.price_coins);
  return r.price_coins == null || !Number.isFinite(p) ? null : p;
}

function compareRewards(a, b) {
  const d = sortKey(a) - sortKey(b);
  if (d !== 0) return d;
  const pa = fixedPrice(a);
  const pb = fixedPrice(b);
  if (pa === null && pb === null) return 0;
  if (pa === null) return 1;
  if (pb === null) return -1;
  return pa - pb;
}

export function groupRewards(categories, rewards, variantsByReward) {
  const grouped = {};
  categories?.forEach((c) => {
    grouped[c.name] = [];
  });

  rewards?.forEach((r) => {
    const item = { ...r, variants: variantsByReward[r.id] ?? [] };
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(item);
    const extras = Array.isArray(r.extra_categories) ? r.extra_categories : [];
    new Set(extras).forEach((name) => {
      // только существующие категории, и не дублируем основную
      if (name !== r.category && grouped[name]) grouped[name].push(item);
    });
  });

  // Порядок в секции: сначала по sort_order (у «Доставки» он -10), дальше
  // по цене; награды без фиксированной цены («на твой выбор») в конце.
  Object.keys(grouped).forEach((key) => {
    grouped[key].sort(compareRewards);
  });

  // Убираем пустые категории из отображения
  Object.keys(grouped).forEach((key) => {
    if (grouped[key].length === 0) delete grouped[key];
  });
  return grouped;
}

// Избранное текущего человека. Таблицы может ещё не быть (миграция не
// применена): тогда просто пусто, магазин не падает.
export async function loadFavoriteIds(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from("reward_favorites")
      .select("reward_id")
      .eq("user_id", userId);
    if (error) return [];
    return (data ?? []).map((f) => f.reward_id);
  } catch {
    return [];
  }
}
