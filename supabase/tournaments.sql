-- Турниры в «Играх» (первый — Clash Royale): взнос коинами в общий банк,
-- олимпийская сетка, победитель забирает банк. Одобрено Ибрагимом 17.10.2026.
--
-- Деньги:
--   взнос        — spend_coins + transactions(type spend, source manual);
--   банк и возвраты — add_coins + transactions(type manual_add, source refund):
--                  это коины коллег, а не новые, поэтому не растят
--                  total_earned/уровни и не попадают в стоимость программы;
--   добавка Pacto — отдельная строка «Бонус: турнир …», source bonus
--                  (настоящие новые коины, считаются в стоимости).
-- Все строки rating_exempt: на рейтинг выручки не влияют.
--
-- Каждый шаг, где двигаются коины или сетка, — одна SQL-функция с
-- блокировкой строки турнира или условным «захватом» матча: двойной тап,
-- параллельный крон и бот не заплатят и не продвинут дважды.

-- ---------- Тег игрока ----------
alter table public.users add column if not exists clash_tag text
  check (clash_tag is null or clash_tag ~ '^#[0289PYLQGRJCUV]{3,14}$');
create unique index if not exists users_clash_tag_uniq on public.users (clash_tag)
  where clash_tag is not null;

-- ---------- Таблицы ----------
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  game text not null default 'clash_royale',
  format text not null default 'single_elim' check (format in ('single_elim', 'league')),
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'registration', 'seeding', 'running', 'finished', 'cancelled')),
  is_test boolean not null default false,       -- видят только админы и участники, без постов в группу
  entry_fee integer not null default 0 check (entry_fee >= 0),
  bonus_coins integer not null default 0 check (bonus_coins >= 0),
  min_players integer not null default 2 check (min_players >= 2),
  max_players integer check (max_players is null or max_players between 2 and 64),
  registration_ends_at timestamptz,
  round_hours integer not null default 24 check (round_hours between 1 and 168),
  confirm_hours integer not null default 6 check (confirm_hours between 0 and 72),
  clan_tag text,
  verify_mode text not null default 'manual' check (verify_mode in ('manual', 'api')),
  pot_coins integer,
  winner_id uuid references public.users (id) on delete restrict,
  started_at timestamptz,
  finished_at timestamptz,
  paid_out_at timestamptz,
  cancelled_at timestamptz,
  reg_reminder_sent_at timestamptz,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_entries (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete restrict,
  paid_coins integer not null default 0 check (paid_coins >= 0),
  clash_tag text,
  seed integer,
  status text not null default 'active' check (status in ('active', 'eliminated', 'winner', 'refunded')),
  joined_at timestamptz not null default now(),
  refunded_at timestamptz,
  primary key (tournament_id, user_id)
);
create index if not exists tournament_entries_user on public.tournament_entries (user_id);

create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round smallint not null,
  slot smallint not null,
  play_date date,                                -- для лиг: день матча
  next_match_id uuid references public.tournament_matches (id) on delete set null,
  next_slot char(1) check (next_slot in ('a', 'b')),
  player_a uuid references public.users (id) on delete restrict,
  player_b uuid references public.users (id) on delete restrict,
  status text not null default 'waiting'
    check (status in ('waiting', 'ready', 'reported', 'disputed', 'done', 'void')),
  ready_at timestamptz,
  play_by timestamptz,
  reminded_at timestamptz,
  overdue_notified_at timestamptz,
  reported_by uuid references public.users (id) on delete set null,
  reported_winner uuid references public.users (id) on delete set null,
  reported_at timestamptz,
  confirm_by timestamptz,
  disputed_by uuid references public.users (id) on delete set null,
  dispute_note text,
  winner_id uuid references public.users (id) on delete restrict,
  method text check (method in ('bye', 'loser_report', 'confirmed', 'auto_confirm', 'admin', 'walkover', 'api')),
  crowns_a smallint,
  crowns_b smallint,
  cr_battle_key text unique,                     -- автопроверка: один бой = один матч
  decided_by uuid references public.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tournament_id, round, slot)
);
create index if not exists tournament_matches_players_a on public.tournament_matches (player_a);
create index if not exists tournament_matches_players_b on public.tournament_matches (player_b);
create index if not exists tournament_matches_reported on public.tournament_matches (confirm_by)
  where status = 'reported';
create index if not exists tournament_matches_ready on public.tournament_matches (play_by)
  where status = 'ready';

-- ---------- Права ----------
-- Читать — вошедшим (черновики и тестовые — только админу и участникам).
-- Писать — только сервер (service role).
alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.tournament_matches enable row level security;

drop policy if exists tournaments_select on public.tournaments;
create policy tournaments_select on public.tournaments for select using (
  auth.uid() is not null and (
    (status <> 'draft' and not is_test)
    or is_admin()
    or exists (select 1 from public.tournament_entries e where e.tournament_id = tournaments.id and e.user_id = auth.uid())
  )
);
drop policy if exists tournament_entries_select on public.tournament_entries;
create policy tournament_entries_select on public.tournament_entries for select using (auth.uid() is not null);
drop policy if exists tournament_matches_select on public.tournament_matches;
create policy tournament_matches_select on public.tournament_matches for select using (auth.uid() is not null);

-- ---------- Записаться ----------
create or replace function public.tournament_join(p_tid uuid, p_uid uuid)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  t public.tournaments;
  u public.users;
  e public.tournament_entries;
  n integer;
  bal integer;
begin
  select * into t from public.tournaments where id = p_tid for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if t.status <> 'registration'
     or (t.registration_ends_at is not null and now() > t.registration_ends_at) then
    return jsonb_build_object('error', 'closed');
  end if;

  select * into u from public.users where id = p_uid;
  if not found or u.is_guest or not u.is_active
     or u.role not in ('mop', 'rop', 'mentor', 'admin')
     or (not t.is_test and u.email like '%.test@pactocoins.local') then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  if u.clash_tag is null then return jsonb_build_object('error', 'no_tag'); end if;
  select * into e from public.tournament_entries where tournament_id = p_tid and user_id = p_uid;
  if found and e.status = 'active' then return jsonb_build_object('error', 'already'); end if;

  select count(*) into n from public.tournament_entries where tournament_id = p_tid and status = 'active';
  if t.max_players is not null and n >= t.max_players then
    return jsonb_build_object('error', 'full');
  end if;

  if t.entry_fee > 0 then
    bal := public.spend_coins(p_uid, t.entry_fee);
    if bal is null then return jsonb_build_object('error', 'insufficient', 'need', t.entry_fee); end if;
    insert into public.transactions (user_id, type, amount_coins, description, created_by, rating_exempt, source)
    values (p_uid, 'spend', -t.entry_fee, 'Турнир «' || t.title || '»: взнос', p_uid, true, 'manual');
  else
    bal := u.balance;
  end if;

  insert into public.tournament_entries (tournament_id, user_id, paid_coins, clash_tag, status, joined_at, refunded_at)
  values (p_tid, p_uid, t.entry_fee, u.clash_tag, 'active', now(), null)
  on conflict (tournament_id, user_id) do update
    set paid_coins = excluded.paid_coins, clash_tag = excluded.clash_tag, status = 'active',
        joined_at = now(), refunded_at = null, seed = null;

  return jsonb_build_object('ok', true, 'balance', bal, 'count', n + 1);
end; $$;

-- ---------- Выйти до старта (и «убрать участника» в админке) ----------
-- Статус записи 'refunded' = вышел до старта или турнир отменён.
create or replace function public.tournament_withdraw(p_tid uuid, p_uid uuid, p_actor uuid)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  t public.tournaments;
  paid integer;
begin
  select * into t from public.tournaments where id = p_tid for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if t.status not in ('draft', 'registration') then return jsonb_build_object('error', 'started'); end if;

  -- строку не удаляем: помечаем «взнос возвращён», повторная запись её оживит
  update public.tournament_entries
     set status = 'refunded', refunded_at = now()
   where tournament_id = p_tid and user_id = p_uid and status = 'active'
  returning paid_coins into paid;
  if not found then return jsonb_build_object('error', 'not_joined'); end if;

  if paid > 0 then
    perform public.add_coins(p_uid, paid);
    insert into public.transactions (user_id, type, amount_coins, description, created_by, rating_exempt, source)
    values (p_uid, 'manual_add', paid, 'Турнир «' || t.title || '»: возврат взноса', p_actor, true, 'refund');
  end if;
  return jsonb_build_object('ok', true, 'refunded', coalesce(paid, 0));
end; $$;

-- ---------- Выплата банка победителю (один раз) ----------
create or replace function public.tournament_payout(p_tid uuid)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  t public.tournaments;
  pool integer;
begin
  select coalesce(sum(paid_coins), 0) into pool
    from public.tournament_entries
   where tournament_id = p_tid and refunded_at is null and status <> 'refunded';

  update public.tournaments
     set status = 'finished', finished_at = now(), paid_out_at = now(), pot_coins = pool + bonus_coins
   where id = p_tid and status = 'running' and winner_id is not null and paid_out_at is null
  returning * into t;
  if not found then return jsonb_build_object('error', 'already'); end if;

  if pool > 0 then
    perform public.add_coins(t.winner_id, pool);
    insert into public.transactions (user_id, type, amount_coins, description, created_by, rating_exempt, source)
    values (t.winner_id, 'manual_add', pool, 'Турнир «' || t.title || '»: выигрыш банка', null, true, 'refund');
  end if;
  if t.bonus_coins > 0 then
    perform public.add_coins(t.winner_id, t.bonus_coins);
    insert into public.transactions (user_id, type, amount_coins, description, created_by, rating_exempt, source)
    values (t.winner_id, 'manual_add', t.bonus_coins, 'Бонус: турнир «' || t.title || '», добавка Pacto', null, true, 'bonus');
  end if;

  update public.tournament_entries set status = 'winner'
   where tournament_id = p_tid and user_id = t.winner_id;
  return jsonb_build_object('ok', true, 'winner', t.winner_id, 'pool', pool, 'bonus', t.bonus_coins);
end; $$;

-- ---------- Итог матча: захват + продвижение по сетке ----------
-- p_from — из каких статусов можно завершить (например {ready,reported}).
create or replace function public.tournament_finish_match(
  p_match uuid, p_winner uuid, p_method text, p_actor uuid, p_from text[]
)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  m public.tournament_matches;
  nxt public.tournament_matches;
  hours integer;
  loser uuid;
  payout jsonb;
begin
  update public.tournament_matches mt
     set status = 'done', winner_id = p_winner, method = p_method,
         decided_by = p_actor, decided_at = now()
   where mt.id = p_match
     and mt.status = any (p_from)
     and p_winner is not null
     and p_winner in (mt.player_a, mt.player_b)
     and exists (select 1 from public.tournaments t where t.id = mt.tournament_id and t.status = 'running')
  returning * into m;
  if not found then return jsonb_build_object('error', 'already'); end if;

  loser := case when m.player_a = p_winner then m.player_b else m.player_a end;
  if loser is not null then
    update public.tournament_entries set status = 'eliminated'
     where tournament_id = m.tournament_id and user_id = loser and status = 'active';
  end if;

  if m.next_match_id is null then
    update public.tournaments set winner_id = p_winner where id = m.tournament_id;
    payout := public.tournament_payout(m.tournament_id);
    return jsonb_build_object('ok', true, 'tournament', m.tournament_id, 'match', m.id,
      'winner', p_winner, 'loser', loser, 'final', true, 'payout', payout);
  end if;

  if m.next_slot = 'a' then
    update public.tournament_matches set player_a = p_winner where id = m.next_match_id returning * into nxt;
  else
    update public.tournament_matches set player_b = p_winner where id = m.next_match_id returning * into nxt;
  end if;

  if nxt.player_a is not null and nxt.player_b is not null and nxt.status = 'waiting' then
    select round_hours into hours from public.tournaments where id = m.tournament_id;
    update public.tournament_matches
       set status = 'ready', ready_at = now(), play_by = now() + make_interval(hours => hours)
     where id = nxt.id;
    return jsonb_build_object('ok', true, 'tournament', m.tournament_id, 'match', m.id,
      'winner', p_winner, 'loser', loser, 'final', false, 'next_match', nxt.id, 'next_ready', true);
  end if;

  return jsonb_build_object('ok', true, 'tournament', m.tournament_id, 'match', m.id,
    'winner', p_winner, 'loser', loser, 'final', false, 'next_match', nxt.id, 'next_ready', false);
end; $$;

-- ---------- Отмена с возвратом всех взносов ----------
create or replace function public.tournament_cancel(p_tid uuid, p_actor uuid)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  t public.tournaments;
  e record;
  refunded uuid[] := '{}';
begin
  select * into t from public.tournaments where id = p_tid for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if t.status not in ('draft', 'registration', 'seeding', 'running') then
    return jsonb_build_object('error', 'already');
  end if;

  update public.tournaments set status = 'cancelled', cancelled_at = now() where id = p_tid;

  for e in
    select user_id, paid_coins from public.tournament_entries
     where tournament_id = p_tid and refunded_at is null and status <> 'refunded'
  loop
    if e.paid_coins > 0 then
      perform public.add_coins(e.user_id, e.paid_coins);
      insert into public.transactions (user_id, type, amount_coins, description, created_by, rating_exempt, source)
      values (e.user_id, 'manual_add', e.paid_coins,
              'Турнир «' || t.title || '»: возврат взноса, турнир отменён', p_actor, true, 'refund');
    end if;
    update public.tournament_entries set refunded_at = now(), status = 'refunded'
     where tournament_id = p_tid and user_id = e.user_id;
    refunded := refunded || e.user_id;
  end loop;

  update public.tournament_matches set status = 'void'
   where tournament_id = p_tid and status not in ('done', 'void');
  return jsonb_build_object('ok', true, 'refunded', to_jsonb(refunded));
end; $$;

-- Только сервер.
revoke all on function public.tournament_join(uuid, uuid) from public, anon, authenticated;
revoke all on function public.tournament_withdraw(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.tournament_payout(uuid) from public, anon, authenticated;
revoke all on function public.tournament_finish_match(uuid, uuid, text, uuid, text[]) from public, anon, authenticated;
revoke all on function public.tournament_cancel(uuid, uuid) from public, anon, authenticated;
grant execute on function public.tournament_join(uuid, uuid) to service_role;
grant execute on function public.tournament_withdraw(uuid, uuid, uuid) to service_role;
grant execute on function public.tournament_payout(uuid) to service_role;
grant execute on function public.tournament_finish_match(uuid, uuid, text, uuid, text[]) to service_role;
grant execute on function public.tournament_cancel(uuid, uuid) to service_role;

-- Применено 17.10.2026 по частям через SQL-редактор (инструмент базы
-- подвисал на крупных запросах). Пустые служебные функции tournament_ping,
-- tournament_ping2, tournament_t1, tournament_t3 остались от отладки:
-- тела пустые, вызов закрыт; удалить: drop function public.tournament_ping(),
-- public.tournament_ping2(uuid), public.tournament_t1(uuid, uuid), public.tournament_t3(uuid);
