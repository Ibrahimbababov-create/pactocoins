-- Магазин: избранное и несколько категорий у награды (октябрь 2026).
-- Миграцию применяет владелец в SQL-редакторе Supabase. Данные не удаляются,
-- скрипт можно запускать повторно. Пока он не применён, магазин работает как
-- раньше: избранное пустое, дополнительных категорий нет.

-- 1. Дополнительные категории награды. Основная остаётся в rewards.category,
--    здесь только «ещё показывать в этих категориях» (названия категорий).
alter table public.rewards
  add column if not exists extra_categories text[] not null default '{}';

comment on column public.rewards.extra_categories is
  'Дополнительные категории, где награда тоже показывается (названия из reward_categories). Основная категория: rewards.category.';

-- 2. Избранное сотрудника: одно сердечко = одна строка.
create table if not exists public.reward_favorites (
  user_id uuid not null references public.users (id) on delete cascade,
  reward_id uuid not null references public.rewards (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, reward_id)
);

comment on table public.reward_favorites is
  'Избранные награды сотрудника (сердечко в магазине). Видит и меняет только сам владелец строки.';

create index if not exists reward_favorites_reward_idx
  on public.reward_favorites (reward_id);

-- 3. Защита строк: каждый работает только со своими.
alter table public.reward_favorites enable row level security;

drop policy if exists reward_favorites_select_own on public.reward_favorites;
create policy reward_favorites_select_own on public.reward_favorites
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists reward_favorites_insert_own on public.reward_favorites;
create policy reward_favorites_insert_own on public.reward_favorites
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists reward_favorites_delete_own on public.reward_favorites;
create policy reward_favorites_delete_own on public.reward_favorites
  for delete to authenticated
  using (auth.uid() = user_id);

-- 4. Права: вошедшие читают, добавляют и удаляют; анонимным доступа нет.
revoke all on public.reward_favorites from anon;
revoke all on public.reward_favorites from authenticated;
grant select, insert, delete on public.reward_favorites to authenticated;
grant all on public.reward_favorites to service_role;
