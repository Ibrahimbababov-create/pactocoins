// Раскладка наград по категориям для магазина (сотрудник и наблюдатель).
// Награда лежит в основной категории (rewards.category) и во всех
// дополнительных (rewards.extra_categories). Если колонки в базе ещё нет,
// extra_categories просто отсутствует и всё работает как раньше.
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
