-- Сундук: подарки от Pacto (фишки, крутки), которые админ иногда кладёт
-- всем. Уже применено в базе (октябрь 2026), файл справочный.
-- Код: lib/chest.js, app/mop/chestActions.js, app/admin/chestActions.js.

create table if not exists public.chest_gifts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  chips integer not null default 0 check (chips >= 0 and chips <= 1000),
  spins integer not null default 0 check (spins >= 0 and spins <= 50),
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (chips > 0 or spins > 0)
);

-- Кто какой подарок открыл: один раз на человека.
create table if not exists public.chest_claims (
  gift_id uuid not null references public.chest_gifts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (gift_id, user_id)
);

alter table public.chest_gifts enable row level security;
alter table public.chest_claims enable row level security;
create policy chest_gifts_read on public.chest_gifts for select using (auth.uid() is not null);
create policy chest_claims_own_read on public.chest_claims for select using (auth.uid() = user_id or is_admin());
-- Писать в обе таблицы может только сервер (service role).

-- Открыть сундук: забрать все неоткрытые подарки разом. Отметка «открыл»
-- и начисление в одной функции, двойной тап второй раз ничего не даст.
create or replace function public.claim_chest(uid uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c_chips integer;
  c_spins integer;
  n integer;
  titles text;
  u record;
begin
  with fresh as (
    insert into public.chest_claims (gift_id, user_id)
    select g.id, uid from public.chest_gifts g where g.is_active
    on conflict do nothing
    returning gift_id
  )
  select coalesce(sum(g.chips), 0), coalesce(sum(g.spins), 0), count(*), string_agg(g.title, ', ')
    into c_chips, c_spins, n, titles
    from fresh f join public.chest_gifts g on g.id = f.gift_id;
  if n = 0 then return jsonb_build_object('error', 'empty'); end if;
  update public.users
     set chips = chips + c_chips, wheel_spins = coalesce(wheel_spins, 0) + c_spins
   where id = uid
  returning chips, wheel_spins into u;
  if c_chips > 0 then
    insert into public.chip_log (user_id, amount, reason) values (uid, c_chips, 'Сундук: ' || titles);
  end if;
  return jsonb_build_object('ok', true, 'chips', c_chips, 'spins', c_spins, 'gifts', n, 'titles', titles,
    'total_chips', u.chips, 'total_spins', u.wheel_spins);
end; $function$;

revoke all on function public.claim_chest(uuid) from public, anon, authenticated;
grant execute on function public.claim_chest(uuid) to service_role;
