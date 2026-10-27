import { createClient } from "@/lib/supabase-server";
import ShopClient from "@/components/ShopClient";
import { groupRewards, loadFavoriteIds } from "@/lib/shopGrouping";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { CURRENT_ANNOUNCEMENT } from "@/lib/announcement";
import { resolveViewer } from "@/lib/viewAs";

export default async function ShopPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Баланс в магазине — всегда свой: смотреть можно чужими глазами, а
  // платить всё равно своими коинами.
  const { watching } = await resolveViewer(supabase, user.id);

  const [{ data: profile }, { data: categories }, { data: rewards }, { data: variants }] =
    await Promise.all([
      supabase.from("users").select("balance, is_guest").eq("id", user.id).single(),
      supabase
        .from("reward_categories")
        .select("*")
        .order("sort_order")
        .order("name"),
      supabase
        .from("rewards")
        .select("*")
        .eq("is_active", true)
        .order("sort_order")
        .order("price_coins"),
      supabase.from("reward_variants").select("*").order("sort_order"),
    ]);

  const variantsByReward = {};
  variants?.forEach((v) => {
    (variantsByReward[v.reward_id] ||= []).push(v);
  });

  // Новинки: награды, добавленные за последние 7 суток (активные, скрытые не берём)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newIds = (rewards ?? [])
    .filter((r) => r.created_at && new Date(r.created_at).getTime() >= weekAgo)
    .map((r) => r.id);

  const grouped = groupRewards(categories, rewards, variantsByReward);
  const favoriteIds = await loadFavoriteIds(supabase, user.id);

  return (
    <div className="space-y-6">
      {CURRENT_ANNOUNCEMENT && (
        <AnnouncementBanner
          storageKey={CURRENT_ANNOUNCEMENT.storageKey}
          icon={CURRENT_ANNOUNCEMENT.icon}
          title={CURRENT_ANNOUNCEMENT.title}
          text={CURRENT_ANNOUNCEMENT.text}
          href={CURRENT_ANNOUNCEMENT.href}
          dismissible={false}
        />
      )}

      {watching && (
        <p className="text-xs text-gray-500 border border-dark-600 rounded-xl px-3 py-2">
          Ты смотришь кабинет чужими глазами, но баланс здесь твой и покупка
          спишется с тебя.
        </p>
      )}

      <ShopClient
        grouped={grouped}
        categoryNames={(categories ?? []).map((c) => c.name)}
        balance={profile?.balance ?? 0}
        favoriteIds={favoriteIds}
        isGuest={!!profile?.is_guest}
        newIds={newIds}
      />
    </div>
  );
}
