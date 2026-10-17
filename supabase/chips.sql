-- Фишки: игровая валюта колеса фортуны (октябрь 2026).
-- Крутки нельзя покупать за коины: коины ценные (на них берут награды), и
-- платная крутка со случайным выигрышем похожа на ставку. Фишки ничего не
-- стоят: их нельзя купить за коины и нельзя обменять на коины. Они выпадают
-- на колесе и тратятся только на крутки. Применено 18.10.2026.

alter table public.users add column if not exists chips integer not null default 0;
alter table public.users add constraint users_chips_nonneg check (chips >= 0);
alter table public.wheel_config add column if not exists spin_price_chips integer not null default 10;
alter table public.wheel_config add constraint wheel_config_spin_price_chips_check check (spin_price_chips between 1 and 1000);
alter table public.wheel_segments drop constraint wheel_segments_prize_type_check,
  add constraint wheel_segments_prize_type_check check (prize_type = any (array['coins','spins','nothing','custom','chips']));

create table if not exists public.chip_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  amount integer not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists chip_log_user_idx on public.chip_log (user_id, created_at desc);
alter table public.chip_log enable row level security;
create policy chip_log_own_read on public.chip_log for select using (auth.uid() = user_id or is_admin());

create or replace function public.add_chips(uid uuid, n integer, p_reason text default null)
 returns integer language plpgsql security definer set search_path to 'public'
as $$
declare v integer;
begin
  if n is null or n = 0 then
    select chips into v from public.users where id = uid;
    return v;
  end if;
  update public.users set chips = greatest(0, chips + n) where id = uid returning chips into v;
  if v is not null then
    insert into public.chip_log (user_id, amount, reason) values (uid, n, p_reason);
  end if;
  return v;
end; $$;

-- Купить крутки за фишки: проверка и списание одним запросом, цена из настроек колеса.
create or replace function public.buy_spins_with_chips(uid uuid, n integer)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  price integer;
  cost integer;
  u record;
begin
  if n is null or n < 1 or n > 50 then return jsonb_build_object('error', 'bad_count'); end if;
  select spin_price_chips into price from public.wheel_config where id = true;
  if price is null or price < 1 then return jsonb_build_object('error', 'no_price'); end if;
  cost := price * n;
  update public.users
     set chips = chips - cost, wheel_spins = coalesce(wheel_spins, 0) + n
   where id = uid and chips >= cost
  returning chips, wheel_spins into u;
  if not found then return jsonb_build_object('error', 'not_enough', 'cost', cost); end if;
  insert into public.chip_log (user_id, amount, reason) values (uid, -cost, 'Крутки ×' || n);
  return jsonb_build_object('ok', true, 'chips', u.chips, 'spins', u.wheel_spins, 'cost', cost);
end; $$;

revoke all on function public.add_chips(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.buy_spins_with_chips(uuid, integer) from public, anon, authenticated;
grant execute on function public.add_chips(uuid, integer, text) to service_role;
grant execute on function public.buy_spins_with_chips(uuid, integer) to service_role;
